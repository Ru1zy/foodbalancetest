#!/usr/bin/env bash
set -Eeuo pipefail

required=(
  DATABASE_PUBLIC_URL
  BACKUP_S3_ENDPOINT
  BACKUP_S3_REGION
  BACKUP_S3_ACCESS_KEY_ID
  BACKUP_S3_SECRET_ACCESS_KEY
  BACKUP_S3_BUCKET
  BACKUP_RECIPIENT_FILE
  BACKUP_POSTGRES_IMAGE
)

sanitize_string() {
  local val="$1"
  # Strip all carriage returns and line feeds
  val="$(printf '%s' "$val" | tr -d '\r\n')"
  # Strip surrounding whitespace
  val="$(printf '%s' "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  # Strip surrounding single or double quotes
  val="$(printf '%s' "$val" | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\\(.*\\)'$/\\1/")"
  # Final whitespace trim
  val="$(printf '%s' "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  printf '%s' "$val"
}

for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Required backup setting is missing: ${name}" >&2
    exit 1
  fi
  clean_val="$(sanitize_string "${!name}")"
  export "$name"="$clean_val"
done

# Deeply sanitize PostgreSQL URL (strip any trailing slashes, newlines, query fragments on dbname)
DATABASE_PUBLIC_URL="$(python3 -c "
import os, re
from urllib.parse import urlsplit, urlunsplit
raw = re.sub(r'[\r\n]', '', os.environ.get('DATABASE_PUBLIC_URL', '')).strip().strip('\"\'').strip()
s = urlsplit(raw)
clean_path = '/' + s.path.strip('/') if s.path else '/railway'
print(urlunsplit((s.scheme, s.netloc, clean_path, s.query, s.fragment)))
" 2>/dev/null || sanitize_string "$DATABASE_PUBLIC_URL")"
export DATABASE_PUBLIC_URL

export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$BACKUP_S3_REGION"

if [[ ! -f "$BACKUP_RECIPIENT_FILE" ]]; then
  echo "Backup recipient file does not exist." >&2
  exit 1
fi

case "$DATABASE_PUBLIC_URL" in
  postgres://*|postgresql://*) ;;
  *)
    echo "DATABASE_PUBLIC_URL is not a PostgreSQL URL." >&2
    exit 1
    ;;
esac

work_dir="${RUNNER_TEMP:-/tmp}/foodbalance-backup-${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}"
mkdir -p "$work_dir"
chmod 700 "$work_dir"

timestamp="$(date -u +'%Y-%m-%dT%H-%M-%SZ')"
base_name="foodbalance-postgres-${timestamp}"
dump_file="${work_dir}/${base_name}.dump"
encrypted_file="${dump_file}.age"
manifest_file="${work_dir}/${base_name}.manifest.txt"
object_prefix="postgres/daily/${timestamp:0:10}"

cleanup() {
  rm -f -- "$dump_file"
}
trap cleanup EXIT

echo "Creating PostgreSQL 18 custom-format dump..."
docker run --rm \
  --env DATABASE_PUBLIC_URL="$DATABASE_PUBLIC_URL" \
  --env PGSSLMODE="${PGSSLMODE:-require}" \
  --volume "${work_dir}:/backup" \
  "$BACKUP_POSTGRES_IMAGE" \
  sh -ceu '
    CLEAN_URL="$(printf "%s" "$DATABASE_PUBLIC_URL" | tr -d "\r\n" | sed -e "s/^[[:space:]]*//" -e "s/[[:space:]]*$//" -e "s/^[\"'\'']//" -e "s/[\"'\'']$//" -e "s/^[[:space:]]*//" -e "s/[[:space:]]*$//")"
    pg_dump --dbname="$CLEAN_URL" --format=custom --compress=9 --no-owner --no-acl --file="/backup/'"${base_name}"'.dump"
  '

docker run --rm \
  --volume "${work_dir}:/backup:ro" \
  "$BACKUP_POSTGRES_IMAGE" \
  pg_restore --list "/backup/${base_name}.dump" >/dev/null

if [[ "${VERIFY_RESTORE:-false}" == "true" ]]; then
  bash scripts/verify-postgres-restore.sh "$dump_file"
fi

plaintext_sha256="$(sha256sum "$dump_file" | awk '{print $1}')"
age --encrypt --recipients-file "$BACKUP_RECIPIENT_FILE" --output "$encrypted_file" "$dump_file"
encrypted_sha256="$(sha256sum "$encrypted_file" | awk '{print $1}')"

cat >"$manifest_file" <<EOF
format_version=1
created_at_utc=${timestamp}
postgres_major=18
encryption=age-ssh-ed25519
plaintext_sha256=${plaintext_sha256}
encrypted_sha256=${encrypted_sha256}
git_sha=${GITHUB_SHA:-local}
EOF

rm -f -- "$dump_file"

destination="s3://${BACKUP_S3_BUCKET}/${object_prefix}"
aws s3 cp "$encrypted_file" "${destination}/${base_name}.dump.age" \
  --endpoint-url "$BACKUP_S3_ENDPOINT" \
  --region "$BACKUP_S3_REGION" \
  --only-show-errors
aws s3 cp "$manifest_file" "${destination}/${base_name}.manifest.txt" \
  --endpoint-url "$BACKUP_S3_ENDPOINT" \
  --region "$BACKUP_S3_REGION" \
  --content-type "text/plain" \
  --only-show-errors

echo "Encrypted backup uploaded: ${object_prefix}/${base_name}.dump.age"
