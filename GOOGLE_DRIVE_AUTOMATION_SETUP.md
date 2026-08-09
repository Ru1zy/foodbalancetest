# Google Drive monthly workbook automation

This runbook connects one administrator-owned Google account. It is completely
separate from customer Google sign-in. Never reuse or replace
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_REDIRECT_URI` while
following this guide.

Do not put any generated value, OAuth secret, refresh token, or recovery code
in this file, Git, an issue, logs, or chat.

## Result

After one admin authorization, FoodBalance:

1. creates `FoodBalance/Monthly Orders` in the connected account;
2. grants the existing Sheets service account editor access to that folder;
3. creates and formats `FOODBALANCE TEMPLATE` with `_Template`;
4. creates the upcoming `MM.YYYY FOODBALANCE` workbook immediately;
5. registers it in PostgreSQL `SheetConfig`;
6. repeats the next-month check automatically on day 20;
7. sends a Telegram alert if automatic provisioning fails.

## 1. Create an isolated Google Cloud project

Use the current developer-controlled Google account for staging. Create a new
Cloud project dedicated to admin Drive automation so changes to its consent
screen cannot affect the existing customer-login OAuth client.

Record the project name, owner alias and recovery details in the encrypted
credential vault. Do not add private account addresses to the repository.

## 2. Enable and configure Google APIs

1. Enable **Google Drive API**.
2. Configure Google Auth Platform / OAuth consent:
   - audience: External for a regular Gmail account;
   - publishing status: In production (Testing refresh tokens for Drive access
     expire after seven days);
   - request only `userinfo.email` and `drive.file`.
3. Create an OAuth client of type **Web application**.
4. Add the exact Railway staging redirect URI:

   ```text
   https://foodbalancetest-production.up.railway.app/api/admin/google-drive/callback
   ```

Do not add this callback to the customer-login OAuth client.

## 3. Create and store the encryption key

Generate one random 32-byte key and encode it as base64. One option on a
developer machine with Node.js is:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"
```

Copy the result directly into the encrypted credential vault and Railway. Do
not paste it into chat or command history notes. The key must be backed up:
without it, a restored database cannot decrypt the Drive refresh token.

## 4. Add Railway variables

Add these values to the Next.js service:

```text
GOOGLE_DRIVE_CLIENT_ID
GOOGLE_DRIVE_CLIENT_SECRET
GOOGLE_DRIVE_REDIRECT_URI
GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY
APP_BASE_URL
```

`GOOGLE_CLIENT_EMAIL` must already contain the Sheets service-account email.
The Drive owner automatically shares the managed folder with this address.

For staging:

```text
GOOGLE_DRIVE_REDIRECT_URI=https://foodbalancetest-production.up.railway.app/api/admin/google-drive/callback
APP_BASE_URL=https://foodbalancetest-production.up.railway.app
```

## 5. Apply the PostgreSQL schema

The deployment is designed to remain readable before this step: the Sheets
settings page reports that the schema is pending and disables the connect
button. Apply the updated Prisma schema specifically to Railway PostgreSQL:

```powershell
npx prisma db push
```

Before running it, verify that the command is using the Railway database, not
Neon production. Do not run `db push` against an unverified `DATABASE_URL`.

The new table is `GoogleDriveConnection`. It stores the connected email,
managed folder/template IDs and only an AES-GCM-encrypted refresh token.

## 6. Connect and verify

1. Sign in to the Railway site as a Telegram administrator.
2. Open `/admin/settings/sheets`.
3. Click `Підключити Google Drive` and choose the current staging owner.
4. Confirm that the page shows the expected connected email.
5. Open the generated folder and template from the page links.
6. Confirm that the next month's workbook exists and a `SheetConfig` row was
   added automatically.
7. Run the GitHub Actions `check-next-month-sheet` job manually. It should
   return success without sending an error alert.
8. Submit one explicitly marked test order for a date in the generated month
   and verify the correct `DD.MM` tab, formatted row and admin status.

## 7. Transfer later to the business account

Do not change customer OAuth. From the same admin page, click
`Перепідключити Google Drive`, authorize the business-controlled Google account,
and verify the new folder/template/month. Transfer or retain old workbooks as
required before changing existing `SheetConfig` rows. Revoke the previous grant
only after a successful observation period.
