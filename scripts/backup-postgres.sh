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

# Deeply sanitize PostgreSQL URL and extract connection components
eval "$(python3 - <<'PY' 2>/dev/null || true
import os, re, shlex
from urllib.parse import urlsplit, unquote

raw = re.sub(r'[\r\n]', '', os.environ.get('DATABASE_PUBLIC_URL', '')).strip().strip('\"\'').strip()
s = urlsplit(raw)
host = s.hostname or ''
port = str(s.port or 5432)
user = unquote(s.username or '')
password = unquote(s.password or '')
db = s.path.strip('/') or 'railway'

clean_url = f"{s.scheme}://{s.netloc}/{db}"
if s.query:
    clean_url += f"?{s.query}"

print(f"export PGHOST={shlex.quote(host)}")
print(f"export PGPORT={shlex.quote(port)}")
print(f"export PGUSER={shlex.quote(user)}")
print(f"export PGPASSWORD={shlex.quote(password)}")
print(f"export PGDATABASE={shlex.quote(db)}")
print(f"export DATABASE_PUBLIC_URL={shlex.quote(clean_url)}")
PY
)"

export PGHOST="${PGHOST:-}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-}"
export PGPASSWORD="${PGPASSWORD:-}"
export PGDATABASE="${PGDATABASE:-railway}"
export PGSSLMODE="${PGSSLMODE:-require}"
export DATABASE_PUBLIC_URL="${DATABASE_PUBLIC_URL:-}"

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

echo "[FoodBalance Backup v2.2.1] Connecting to host=${PGHOST}, port=${PGPORT}, user=${PGUSER}, db=${PGDATABASE}..."
echo "Creating PostgreSQL 18 custom-format dump..."
docker run --rm \
  --env PGHOST="$PGHOST" \
  --env PGPORT="$PGPORT" \
  --env PGUSER="$PGUSER" \
  --env PGPASSWORD="$PGPASSWORD" \
  --env PGDATABASE="$PGDATABASE" \
  --env PGSSLMODE="$PGSSLMODE" \
  --volume "${work_dir}:/backup" \
  "$BACKUP_POSTGRES_IMAGE" \
  sh -ceu '
    if [ -n "$PGHOST" ]; then
      pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --format=custom --compress=9 --no-owner --no-acl --file="/backup/'"${base_name}"'.dump"
    else
      pg_dump --dbname="$DATABASE_PUBLIC_URL" --format=custom --compress=9 --no-owner --no-acl --file="/backup/'"${base_name}"'.dump"
    fi
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
