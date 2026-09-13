#!/usr/bin/env bash
set -Eeuo pipefail

dump_file="${1:-}"
if [[ -z "$dump_file" || ! -f "$dump_file" ]]; then
  echo "A readable dump file is required for restore verification." >&2
  exit 1
fi

DATABASE_PUBLIC_URL="$(printf '%s' "${DATABASE_PUBLIC_URL:-}" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\\(.*\\)'$/\\1/" -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
export DATABASE_PUBLIC_URL

if [[ -z "${DATABASE_PUBLIC_URL:-}" || -z "${BACKUP_POSTGRES_IMAGE:-}" ]]; then
  echo "Restore verification environment is incomplete." >&2
  exit 1
fi

restore_database="foodbalance_restore_${GITHUB_RUN_ID:-manual}_${GITHUB_RUN_ATTEMPT:-1}"
restore_database="${restore_database//[^a-zA-Z0-9_]/_}"
if [[ ! "$restore_database" =~ ^foodbalance_restore_[a-zA-Z0-9_]+$ ]]; then
  echo "Unsafe temporary restore database name." >&2
  exit 1
fi

mapfile -t database_urls < <(
  SOURCE_DATABASE_URL="$DATABASE_PUBLIC_URL" RESTORE_DATABASE="$restore_database" python3 - <<'PY'
import os, re
from urllib.parse import urlsplit, urlunsplit

source_raw = re.sub(r'[\r\n]', '', os.environ["SOURCE_DATABASE_URL"]).strip().strip('\"\'').strip()
source = urlsplit(source_raw)
if source.scheme not in {"postgres", "postgresql"} or not source.hostname:
    raise SystemExit("Invalid PostgreSQL source URL")

restore_name = os.environ["RESTORE_DATABASE"].strip()
admin = source._replace(path="/postgres", query="", fragment="")
restore = source._replace(path=f"/{restore_name}", query="", fragment="")
print(urlunsplit(admin).strip())
print(urlunsplit(restore).strip())
PY
)

admin_database_url="${database_urls[0]:-}"
restore_database_url="${database_urls[1]:-}"
if [[ -z "$admin_database_url" || -z "$restore_database_url" ]]; then
  echo "Could not derive temporary restore URLs." >&2
  exit 1
fi

cleanup_restore_database() {
  docker run --rm \
    --env PGSSLMODE="${PGSSLMODE:-require}" \
    "$BACKUP_POSTGRES_IMAGE" \
    psql "$admin_database_url" --set=ON_ERROR_STOP=1 \
    --command="DROP DATABASE IF EXISTS \"${restore_database}\" WITH (FORCE)" >/dev/null
}
trap cleanup_restore_database EXIT

cleanup_restore_database
docker run --rm \
  --env PGSSLMODE="${PGSSLMODE:-require}" \
  "$BACKUP_POSTGRES_IMAGE" \
  psql "$admin_database_url" --set=ON_ERROR_STOP=1 \
  --command="CREATE DATABASE \"${restore_database}\"" >/dev/null

docker run --rm \
  --env PGSSLMODE="${PGSSLMODE:-require}" \
  --volume "$(dirname "$dump_file"):/backup:ro" \
  "$BACKUP_POSTGRES_IMAGE" \
  pg_restore --exit-on-error --no-owner --no-acl \
  --dbname="$restore_database_url" "/backup/$(basename "$dump_file")" >/dev/null

tables=(User Order UserBalance Menu Tariff SheetConfig GoogleDriveConnection)
for table in "${tables[@]}"; do
  source_count="$(docker run --rm --env PGSSLMODE="${PGSSLMODE:-require}" "$BACKUP_POSTGRES_IMAGE" psql "$DATABASE_PUBLIC_URL" --tuples-only --no-align --command="SELECT count(*) FROM \"${table}\"")"
  restored_count="$(docker run --rm --env PGSSLMODE="${PGSSLMODE:-require}" "$BACKUP_POSTGRES_IMAGE" psql "$restore_database_url" --tuples-only --no-align --command="SELECT count(*) FROM \"${table}\"")"
  if [[ "$source_count" != "$restored_count" ]]; then
    echo "Restore verification count mismatch for a core table." >&2
    exit 1
  fi
done

echo "Temporary restore completed and core table counts match."
