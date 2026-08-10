# FoodBalance infrastructure inventory

This file is a map of systems and ownership. It must never contain passwords,
API tokens, private keys, database connection strings, recovery codes, refresh
tokens, or complete service-account JSON documents.

Real credentials belong in an encrypted team/personal secret vault. Runtime
copies belong only in Railway variables or GitHub Actions secrets. `.env.example`
contains variable names and placeholders only.

The operational setup for monthly Drive automation is documented in
`GOOGLE_DRIVE_AUTOMATION_SETUP.md`.

## Ownership aliases

| Alias | Meaning |
| --- | --- |
| Current Google owner | Developer-controlled Google account used for the first stable Railway launch |
| Business Google owner | Business-controlled Google account used after the staged ownership transfer |
| Business owner | Person legally/operationally responsible for FoodBalance |

Do not replace aliases with private email addresses in this public repository.

## Service catalog

| System | Purpose | Current authority | Configuration / identifiers | Secret-vault record |
| --- | --- | --- | --- | --- |
| GitHub repository | Source, Actions cron, deployment source | Repository owner/collaborators | `Ru1zy/foodbalancetest`, `main`; Actions variables are configured in repository settings | `FoodBalance / GitHub` |
| Railway application | Next.js staging candidate, later production | Railway project members | Project `capable-trust`; app service `foodbalancetest`; public staging domain is recorded in `MIGRATION_STATUS.md` | `FoodBalance / Railway` |
| Railway PostgreSQL | Application database after cutover | Railway project members | Attached PostgreSQL service; runtime URL is referenced only through `DATABASE_URL` | `FoodBalance / Railway PostgreSQL` |
| Neon PostgreSQL | Current production database and pre-cutover source | Current database owner | Keep available as production/fallback until final sync and observation period finish | `FoodBalance / Neon` |
| Vercel | Current production/fallback deployment until cutover | Vercel project members | Disable its cron at cutover; do not delete until rollback procedure is verified | `FoodBalance / Vercel` |
| Cloudflare R2 images | Public menu/tariff images | Cloudflare account members | Bucket `foodbalance`; endpoint, region and public base URL are represented by `S3_*` variables | `FoodBalance / Cloudflare R2` |
| Cloudflare R2 database backups | Private encrypted PostgreSQL dumps | Cloudflare account members | Bucket `foodbalance-database-backups`; 7-day deletion lock and 90-day lifecycle on `postgres/` | `FoodBalance / Database backups` |
| Google Cloud: customer sign-in | Existing Google OAuth login | Current Google owner | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`; do not mix with Drive OAuth | `FoodBalance / Google customer OAuth` |
| Google Cloud: Drive automation | Admin-only offline Drive access | Current Google owner first; business owner later | Separate Cloud project/client; Drive API enabled; scope `drive.file`; variables use `GOOGLE_DRIVE_*` | `FoodBalance / Google Drive OAuth` |
| Google Sheets service account | Writes global CRM, kitchen and monthly order rows | Current Google owner first | `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`; legacy kitchen route also uses `GOOGLE_SERVICE_ACCOUNT_KEY` | `FoodBalance / Google service account` |
| Global CRM Sheet | `Info` and `Orders` tabs | Current Google owner first | ID is stored only as `GOOGLE_SHEET_ID` | `FoodBalance / Google Sheets destinations` |
| Kitchen Sheet | Kitchen export destination | Current Google owner first | ID is stored only as `EXTERNAL_SHEET_ID` | `FoodBalance / Google Sheets destinations` |
| Monthly order workbooks | One workbook per month with daily `DD.MM` tabs | Connected Drive owner | IDs are stored in PostgreSQL `SheetConfig`; master/folder IDs live in `GoogleDriveConnection` | `FoodBalance / Google Drive OAuth` |
| Telegram test bot | Staging login, webhook and admin alerts | Developer-controlled Telegram account | Bot username is public; token/webhook secret are Railway variables | `FoodBalance / Telegram staging bot` |
| Telegram business bot | Existing live business workflow | Business owner | Do not move or rotate until Railway is green and the cutover window begins | `FoodBalance / Telegram production bot` |
| GitHub Actions automation | Archive jobs, monthly workbook provisioning, encrypted database backups | Repository collaborators | Runtime values are stored only in repository Actions secrets | `FoodBalance / GitHub Actions` |
| DNS / production domain | Final public routing | Domain account owner | Registrar, DNS zone and TTL must be recorded in the vault before cutover | `FoodBalance / Domain and DNS` |
| Payment provider | Future card acquiring | Business owner | Not selected; production keys must belong to the business merchant | `FoodBalance / Payments` |

## Secret-vault checklist

Each named vault record should include, where applicable:

- login URL and account/owner alias;
- username, password and 2FA recovery method;
- recovery codes stored as a protected attachment/note;
- project/service/bucket names (not only opaque IDs);
- API keys and the date they were created;
- who can rotate or revoke the credential;
- billing owner and renewal/payment method;
- last restore/login test date;
- decommission date after a completed migration.

## Runtime secret locations

| Location | What belongs there |
| --- | --- |
| Railway variables | App/runtime secrets and URLs required by Next.js |
| GitHub Actions secrets | `APP_BASE_URL`, `CRON_SECRET`, `DATABASE_PUBLIC_URL`, and scoped `BACKUP_S3_*` values |
| Encrypted secret vault | Master copy of every credential, recovery code and encryption key |
| PostgreSQL | Only application data and the AES-encrypted Drive refresh token |
| Repository | Variable names, runbooks and ownership aliases only |

`GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` must be backed up in the encrypted vault.
Without it, a restored PostgreSQL dump cannot decrypt the saved Google Drive
refresh token; reconnecting Drive would then be required.

The database-backup decryption identity must also be copied into the encrypted
vault. Its current local recovery copy is documented in
`DATABASE_BACKUP_RUNBOOK.md`; the repository contains only its public recipient.

## Ownership-transfer checklist

1. Add the Business Google owner as an owner/editor without removing the
   Current Google owner.
2. Copy/transfer Sheets and Drive assets while both accounts can verify them.
3. Reconnect admin Drive OAuth from the FoodBalance admin page using the
   business account; this replaces the encrypted refresh token.
4. Switch service-account credentials separately and verify CRM, kitchen and
   monthly destinations after each change.
5. Transfer billing/project ownership where the provider supports it.
6. Test login, order export, cron and backup restore.
7. Revoke the previous credentials only after an observation period and a
   documented rollback test.
8. Update this inventory and the encrypted vault on the same day.

## Review cadence

- Review access and billing monthly during migration, then quarterly.
- Test a database restore at least quarterly and after backup changes.
- Rotate any credential immediately after accidental disclosure.
- Remove former collaborators promptly, but never before confirming another
  owner and recovery path exist.
