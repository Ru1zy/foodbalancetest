# FoodBalance PostgreSQL backup runbook

The Railway PostgreSQL database is backed up by
`.github/workflows/database-backup.yml` every day at 03:20 UTC. Each run uses
PostgreSQL 18 `pg_dump` in custom format, validates the archive, encrypts it
with `age`, and uploads only the encrypted artifact and a checksum manifest to
the private Cloudflare R2 bucket `foodbalance-database-backups`.

## Retention and deletion protection

- Objects under `postgres/` cannot be deleted during their first 7 days.
- R2 expires objects after 90 days.
- The bucket has no public domain or `r2.dev` access.
- The public image bucket `foodbalance` is separate and must never receive a
  database dump.

## Required GitHub Actions secrets

- `DATABASE_PUBLIC_URL`
- `BACKUP_S3_ENDPOINT`
- `BACKUP_S3_REGION`
- `BACKUP_S3_ACCESS_KEY_ID`
- `BACKUP_S3_SECRET_ACCESS_KEY`
- `BACKUP_S3_BUCKET`

The R2 access key must be scoped only to `foodbalance-database-backups` with
Object Read & Write permission. Never reuse the public-image application key.

## Encryption identity

The repository contains only `.github/backup-recipient.pub`, which can encrypt
but cannot decrypt backups. The matching private identity is stored outside the
repository at:

`C:\Users\unrui\.ssh\foodbalance_backup_age_ed25519`

Copy that private key into the encrypted FoodBalance secret vault. Losing it
means every existing encrypted backup becomes unrecoverable. Do not upload it
to GitHub, Railway, R2, chat, email, or the public repository.

## Manual backup and actual restore verification

Run **Actions -> Encrypted PostgreSQL backup -> Run workflow** with
`verify_restore = true`. The workflow creates a uniquely named temporary
database on the same Railway PostgreSQL service, restores the dump, compares
row counts for core application tables, and drops only that temporary database.
Scheduled daily runs validate the dump structure but do not create a temporary
database.

## Full disaster restore

1. Download a `.dump.age` object and its `.manifest.txt` from the private R2
   bucket.
2. Install `age` and PostgreSQL 18 client tools on the recovery machine.
3. Decrypt with the offline identity:
   `age --decrypt --identity <private-key-path> --output foodbalance.dump <backup.dump.age>`
4. Verify the plaintext SHA-256 against `plaintext_sha256` in the manifest.
5. Restore into an empty PostgreSQL database:
   `pg_restore --exit-on-error --no-owner --no-acl --dbname <target-url> foodbalance.dump`
6. Run application smoke tests before directing any production traffic to the
   restored database.

Never restore over the live database. Restore into a new empty database first,
verify it, and switch the application only after review.
