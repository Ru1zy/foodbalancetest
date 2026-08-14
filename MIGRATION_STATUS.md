# FoodBalance: migration and product roadmap

Last updated: 2026-08-10

This is the live project tracker. Read it before making changes and update the
checkboxes and notes after every completed step. Never put credentials, tokens,
private keys, database URLs, or other secret values in this file.

## Status legend

- `[x]` completed and verified
- `[ ]` not completed
- `BLOCKED` requires a business decision or an external account action

## Current production strategy

- Current production remains on Vercel + Neon until the Railway environment is
  fully verified and a final database sync is completed.
- The Railway environment is currently a staging candidate at
  `https://foodbalancetest-production.up.railway.app`.
- Google OAuth and Google Sheets stay on the current owner's Google account for
  the first production launch.
- Migration to `foodbalancezp@gmail.com` happens gradually only after the new
  production is stable. Do not touch the corporate account's working Telegram
  bot or Google setup during the initial launch.
- `/api/balance/topup` must remain `501 Not Implemented` until a payment is
  verified server-side. Never credit balance from an untrusted client request.

## Phase 0: Vercel/Neon to Railway

### Completed

- [x] S3-compatible storage implementation merged (`lib/storage.ts`).
- [x] GitHub Actions cron implementation merged (`.github/workflows/cron.yml`).
- [x] Railway project and Railway PostgreSQL created.
- [x] Railway application deployed from `main`.
- [x] Initial Neon snapshot restored to Railway PostgreSQL.
- [x] All table row counts and table-content hashes matched after the initial
  restore.
- [x] Railway public smoke test passed for the home page and safe API routes.
- [x] GitHub Actions secrets `APP_BASE_URL` and `CRON_SECRET` configured.
- [x] Cron workflow manually executed successfully on commit `7a6f8ff`.
- [x] Cron endpoints changed to fail closed when `CRON_SECRET` is absent.
- [x] Railway Google callback URI added to the existing Google OAuth web client.
- [x] Google callback redirects use the public origin from
  `GOOGLE_REDIRECT_URI` instead of Railway's internal `localhost:8080` origin;
  the deployed missing-code redirect was verified on 2026-08-08.
- [x] Google OAuth was tested with a new Google user on Railway and reached the
  onboarding phone step successfully.
- [x] The onboarding phone input now explicitly uses a white background and
  black text/caret so browser theme defaults cannot make it unreadable.
- [x] Incomplete Google accounts can no longer bypass onboarding through
  checkout: the header prompt links back to `/onboarding`, the swallowed
  `NEXT_REDIRECT` bug is fixed, and server actions reject direct submissions.
- [x] Authenticated checkout no longer auto-merges accounts solely by a typed
  phone number. The unsafe path could delete the older user and cascade-delete
  balances; phone collisions now fail without changing either account.
- [x] Telegram deep-link authentication was hardened and deployed: public
  confirmation was removed, existing users are no longer detached from their
  `chatId`, and the webhook fails closed without `TELEGRAM_WEBHOOK_SECRET`.
- [x] The FoodDevTest webhook was moved from Vercel to Railway with a Telegram
  secret token on 2026-08-09. Telegram reported the Railway host, zero pending
  updates, and no delivery error after registration.
- [x] The Neon user detached by the legacy deep-link handler during staging was
  safely relinked to the original account with its 11 orders. The empty
  technical duplicate was retained for later reviewed cleanup.
- [x] After the hardened Railway Telegram login was verified, its temporary
  placeholder profile was safely detached and the Telegram `chatId` was moved
  to the established Railway snapshot account with 11 orders. No user row or
  order was deleted; the empty placeholder remains for reviewed cleanup.
- [x] Basic read-only load check: 100/100 successful requests, concurrency 10,
  p50 about 109 ms and p95 about 364 ms.
- [x] Railway usage reviewed. Nearly all current cost is baseline application
  RAM; CPU, egress, PostgreSQL, and volume costs are small. Hobby is expected to
  be around the USD 5 minimum at the current scale.
- [x] Added `INFRASTRUCTURE_INVENTORY.md` with service ownership aliases,
  credential locations, recovery expectations, and a gradual ownership-transfer
  checklist. It intentionally contains no live secrets or private identifiers.
- [x] Added a database-aware `/api/health` endpoint and Railway config-as-code
  healthcheck so a new deployment must prove that Next.js and PostgreSQL are
  reachable before Railway switches traffic.
- [x] Dependency security refresh: Next.js/ESLint config upgraded to `16.3.0`,
  Prisma packages aligned on `7.9.1`, and the unused legacy `@vercel/blob`
  package removed. `npm audit` reports zero known vulnerabilities; Prisma
  generate/validate, lint, TypeScript, and the Next.js production build pass.

### Required before cutover

- [ ] Retest Google OAuth with an existing completed user. Expected result:
  the user reaches `/profile` without onboarding.
- [x] Investigate the tested onboarding phone conflict before changing account
  linking: Railway finds an existing user with that normalized phone but with
  `chatId = null`. Compare that record with current Neon during the final sync;
  the Railway database is an earlier snapshot. Do not auto-merge accounts from
  a typed phone number without proof of ownership. The conflicting Neon and
  Railway records were identified and repaired without phone-based auto-merge;
  the final full database sync is still required before cutover.
- [x] Retest Telegram login/deep-link flow after the hardened fix is deployed.
  The 2026-08-09 staging test could not complete because the bot webhook still
  targeted Vercel/Neon while the browser polled Railway/PostgreSQL. The old
  confirmation endpoint also detached an existing user's `chatId` and trusted
  public confirmation requests; the local fix removes both behaviours and
  requires `TELEGRAM_WEBHOOK_SECRET` to fail closed. The repeated test reached
  `/profile` successfully after the webhook was moved to Railway.
- [x] Test an authenticated admin login on Railway. The repaired Telegram admin
  account reached `/admin` successfully on 2026-08-09.
- [x] Test S3 image upload from the Railway admin menu page. A reduced image
  uploaded successfully, its public preview loaded, and the new `photoUrl`
  appeared on the Thursday `Template` menu card.
- [x] Test one non-production checkout end-to-end without real payment. A
  Telegram-authenticated cash order for Slim was submitted on Railway on
  2026-08-09 with an explicit test/no-delivery comment.
- [x] Verify the order is persisted in PostgreSQL. The test order appeared in
  the Railway admin order/client views.
- [x] Verify the global CRM `Orders` tab write. The test order appeared in the
  existing all-clients spreadsheet.
- [x] Verify the global CRM `Info` tab write separately. A read-only Sheets API
  check found the Railway test client with populated name, phone, address,
  Telegram Chat ID, and package fields; no additional order was created.
- [x] Verify month/day Sheet writes configured through `SheetConfig`. The first
  test correctly produced the admin Telegram fallback warning with no monthly
  mapping. After an August test workbook and `_Template` were configured, a
  second order created/populated the `11.08` day tab with the expected client,
  package, dishes, comment, and price.
- [x] Deploy the admin-owned Google Drive automation code and apply the
  `GoogleDriveConnection` model to Railway PostgreSQL. Customer Google login
  remains untouched.
- [x] Activate and verify Google Drive automation: the separate `drive.file`
  OAuth client and Railway variables are configured, the current admin account
  is authorized, and the managed folder, `_Template`, and `09.2026` workbook
  were created. The first live run exposed Prisma 7's inability to deserialize
  the `void` result of `pg_advisory_xact_lock`; commit `ab9c624` selects a typed
  lock result instead. The protected endpoint then returned success, and a
  second run reused the existing workbook without creating a duplicate.
- [x] Manually dispatch the `check-next-month-sheet` job in GitHub Actions once
  to verify the scheduler's repository secrets and end-to-end invocation path.
  Run `31412473887` completed successfully on 2026-08-10.
- [x] Verify admin pages: orders, today, clients, menu, tariffs, and Sheets
  settings all rendered under the authenticated Railway admin session.
- [x] Fix the Today-page notification mismatch found during that review. Cash
  and bank-transfer deliveries were displayed but silently excluded from the
  Telegram send query because `isPaid` was false. Active non-cancelled orders
  are now eligible regardless of payment confirmation; skipped reasons are
  visible, date ranges are Kyiv/DST-aware, Telegram HTML is escaped, and both
  Today mutations re-check admin authorization. No notification was sent while
  verifying the explicit no-delivery test order.
- [x] Implement external logical PostgreSQL backups without Railway Pro. Daily
  GitHub Actions dumps use the PostgreSQL 18 client, validate the custom-format
  archive, encrypt it with an offline age/SSH recipient, and upload only the
  ciphertext plus checksum manifest to the separate private Cloudflare R2
  bucket `foodbalance-database-backups`. The bucket has a 7-day deletion lock
  and 90-day expiration policy. Manual run `31418162809` restored into a
  uniquely named temporary database, matched core table counts, removed the
  temporary database, and uploaded the encrypted object. The exact R2 object
  was then downloaded, decrypted locally with the offline identity, and matched
  the manifest's plaintext SHA-256. See `DATABASE_BACKUP_RUNBOOK.md`.
- [ ] Copy the offline backup private identity from the documented local path
  into the encrypted FoodBalance secret vault. Do not proceed to cutover with
  the laptop as the only recovery copy.
- [ ] Perform a final Neon -> Railway database sync during a no-write window.
  The current Railway database is only an earlier test snapshot.
- [ ] Reduce DNS TTL before cutover.
- [ ] Point the production domain to Railway.
- [ ] Set the final custom-domain `GOOGLE_REDIRECT_URI` in Railway and add the
  exact URI to Google Cloud Console:
  `https://<production-domain>/api/auth/google/callback`.
- [ ] Reinstall the Telegram webhook on
  `https://<production-domain>/api/telegram-webhook`.
- [ ] Change GitHub Actions `APP_BASE_URL` to the final production domain.
- [ ] Remove or disable Vercel cron execution so jobs cannot run twice. Keep
  only one active scheduler.
- [ ] Keep the Vercel deployment available as a fallback until Railway is
  stable, but document that a fallback after live writes also requires a fresh
  Railway -> Neon database transfer.
- [ ] Rotate every secret exposed in the earlier chat after cutover: Telegram
  bot token, database password, Google service-account key, OAuth client secret,
  and the old Blob token.

## Phase 1: order data and automatic operations

### What already exists

- Checkout persists an `Order` in PostgreSQL inside a transaction.
- Checkout idempotency prevents ordinary retries/double-clicks from creating a
  second order or deducting balance twice.
- Selected dishes are stored in `Order.items` JSON.
- Post-commit code sends an admin Telegram notification and attempts to write
  to the global CRM Sheet and month/day Sheets.
- The admin orders table shows a red monthly-table warning beside the client
  when any delivery month has no current `SheetConfig`; a configured order
  leaves that cell empty.
- Month/day export now derives each tab date from the selected menu weekday,
  so non-consecutive picks such as Monday + Thursday no longer become Monday +
  Tuesday in Sheets.
- New monthly rows trim accidental whitespace from single-line fields and
  auto-resize their row while retaining template-defined column widths/wrapping.
- Monthly rows now use the Sheets append operation instead of a
  count-then-update race, and concurrent creation of the same `DD.MM` tab
  recovers cleanly. Global CRM/monthly writes are awaited concurrently after
  the database commit so Railway cannot suspend unfinished export promises.
- Global CRM `Orders` delivery dates now use the actual selected menu weekdays
  and Kyiv calendar time; non-consecutive picks no longer collapse into
  consecutive dates there either.
- User balances already use `UserBalance(packageId, totalDays, usedDays)`.
- The profile already displays remaining days per package.

### Required corrections

- [x] Store delivery days in normalized `OrderDay` rows linked to the parent
  `Order`. Each row has its exact date, weekday, selected items, immutable menu
  snapshot, per-day delivery time/note, and cancellation-ready status fields.
  The additive Railway schema/backfill workflow run `31420802048` converted 18
  existing orders into 30 delivery-day rows with zero skipped orders.
- [x] Correct `/admin/today` so every order appears on every selected delivery
  day, not only on its earliest `deliveryDate`. New orders dual-write the legacy
  aggregate fields and normalized days atomically; legacy fallback remains for
  safe rolling deploys.
- [x] Ensure non-consecutive selections (for example Monday, Wednesday, Friday)
  retain their real calendar dates in PostgreSQL, admin screens, Telegram, and
  Sheets. PostgreSQL now stores the dates directly; the previously verified
  weekday-aware Telegram and Sheet exporters remain compatible.
- [ ] Make external integrations reliable with a database outbox/job table and
  retries. `syncClientToSheet` and `appendOrderToSheet` are currently started
  without awaiting completion, so a process restart can lose the write.
- [ ] Add idempotency to each Sheet destination so retrying a job cannot create
  duplicate rows.
- [x] Reconcile Google credential formats. All Sheets paths now construct the
  same service-account client from `GOOGLE_CLIENT_EMAIL` +
  `GOOGLE_PRIVATE_KEY`; the obsolete `GOOGLE_SERVICE_ACCOUNT_KEY` format is no
  longer read by the application. Remove that unused Railway secret only after
  the post-deploy kitchen-export verification.
- [x] Verify and document the purpose of all current Sheet destinations:
  - `GOOGLE_SHEET_ID` is the global CRM workbook, with `Info` client rows and
    `Orders` delivery-day rows.
  - `EXTERNAL_SHEET_ID` is the separate manually-maintained kitchen/delivery
    workbook used only by the authenticated admin export action.
  - `SheetConfig` is a PostgreSQL mapping from `MM.YYYY` to the automated
    monthly workbook, whose `DD.MM` tabs are created from `_Template`.
  - The unused legacy `format=sheets` API mode was disabled because it wrote
    kitchen exports into the CRM workbook. CSV download and the dedicated admin
    kitchen export continue unchanged.
- [x] Close the known Sushka server-side price-validation gap before payment
  work. Checkout now derives XS/S totals and partial-balance remainders from
  trusted package prices, rejects browser price mismatches, and blocks the
  technical `Sushka`/`Template` entries from becoming zero-price orders.
  Covered by the `npm test` order-pricing checks.

## Phase 2: subscriptions and personal account

- [ ] Replace fixed duration cards with an integer day selector after the
  allowed minimum and maximum are confirmed.
- [ ] Display the discount rules above the selector.
- [ ] Implement server-side discount calculation and store an immutable price
  snapshot for every purchase:
  - 5-6 days: 3%
  - 7-13 days: 5%
  - 14-29 days: 10%
  - 30 days: 15%
- [ ] Require Telegram registration for discounted subscription purchases, if
  confirmed by the business owner.
- [ ] Keep remaining days visible in the profile and show purchase/payment
  history.
- [ ] Decide whether balance remains package-specific. The current unique key is
  `(userId, packageId)`.
- [ ] Create a separate subscription-purchase/payment model. Do not overload a
  food-delivery `Order` with subscription payment state.
- [ ] Support idempotent balance crediting so callbacks, retries, and admin
  double-clicks cannot add days twice.

## Phase 3: payment methods

### Card acquiring (provider not selected)

Current research as of 2026-08-09:

- plata by mono and LiqPay both advertise a standard 1.3% acquiring fee for
  Ukrainian cards and 2% for foreign cards. Their standard public acquiring
  terms do not yet prove that the payer can cover this fee while the merchant
  receives the exact invoice amount.
- WayForPay advertises 2%; Fondy advertises 2.2% for Ukrainian cards below
  UAH 500,000 monthly turnover. Plata and LiqPay are the current shortlist.
- Plata has a public test environment/token available without an activated
  acquiring terminal. Test-token checkout does not show Apple Pay or Google
  Pay, so wallets require a small final live smoke test with the owner's
  merchant followed by a refund.
- LiqPay issues separate sandbox and production key pairs per merchant and
  provides test cards without real settlement.
- LiqPay documents `commission_payer: sender` for split-payment recipients, but
  this has not been confirmed for ordinary Checkout. Plata exposes an
  `agentFeePercent` API field, but its ordinary acquiring agreement says the
  acquiring fee is withheld from merchant settlement; agent/submerchant
  features may require separate approval.
- Portmone publishes payer-funded tariffs (2.6%, minimum UAH 3, to a current
  account; or 1% + UAH 1 to a card), but these have limited invoicing/card
  functionality and are not equivalent to its full contracted merchant plan.
- BLOCKED: the business wants the subscription price to remain, for example,
  UAH 600, the payment provider to disclose and charge its own fee separately
  to the payer, and the merchant to receive exactly UAH 600. FoodBalance must
  not emulate this by adding its own card-only surcharge or by setting a
  different card price. Select a provider/product only after its contract,
  checkout, receipt, callback, settlement, refunds, and fiscalization all
  explicitly support a provider-level payer fee.

- [ ] Get written confirmation from plata by mono, LiqPay, and/or Portmone that
  their normal website checkout can charge a separately disclosed provider fee
  to the payer while settling the exact base invoice amount to the merchant.
- [ ] Select the provider only after the business owner confirms the settlement
  account, merchant contract, payer-fee terms, and fiscalization requirements.
- [ ] Obtain test credentials first; obtain production credentials only from
  the business owner's activated merchant.
- [ ] Confirm Apple Pay and Google Pay availability on the production merchant.
- [ ] Create payment attempts server-side using trusted tariff/day values.
- [ ] Verify provider webhook signatures server-side.
- [ ] Credit subscription days only after a verified successful callback.
- [ ] Add webhook idempotency, payment reconciliation, and failed/refunded
  states.
- [ ] Keep `/api/balance/topup` disabled until this verified path replaces it.

### Bank transfer / account payment

- [ ] Show the calculated amount and business payment details.
- [ ] Add a dedicated authenticated receipt-upload flow. Do not reuse the
  admin-only public menu-image upload route.
- [ ] Store receipts in a private bucket; expose them only to authorized admins.
- [ ] After a receipt is uploaded, credit the subscription once with status
  `credited_pending_confirmation`, as requested by the owner.
- [ ] Send a prominent Telegram alert to the admin with the client, amount,
  method, and a link to the pending payment.

### Cash

- [ ] Credit the subscription once when the cash purchase is created, with
  status `credited_pending_confirmation`.
- [ ] Put the purchase in the same pending-payment queue without requiring a
  receipt.
- [ ] Mark the payment method clearly as cash.

## Phase 4: admin pending-payments workflow

- [ ] Add an admin page/tab named `Неоплачені` with a visible pending counter.
- [ ] Show at minimum: client name, phone, amount, payment method, package, days,
  creation time, and receipt when present.
- [ ] Add an idempotent `Confirm payment` action.
- [ ] Add a rejection/cancellation path only after the owner defines what to do
  with days that were already credited or consumed.
- [ ] Remove confirmed entries from the pending view but retain an audit history.
- [ ] Record who confirmed the payment and when.

## Phase 5: Telegram delivery experience and notifications

- [ ] Keep Telegram as the primary registration path for customers who want
  discounts and subscriptions.
- [ ] Verify the existing delivery-time notification flow end-to-end.
- [ ] Decide whether delivery time is sent automatically when an admin enters it
  or only after the existing explicit `Notify` action.
- [ ] Add email duplication of admin Telegram alerts only after an email provider,
  sender domain, recipients, and delivery policy are selected.

## Phase 6: verification and release

- [ ] Add unit tests for every discount boundary: 4, 5, 6, 7, 13, 14, 29, 30,
  and any confirmed maximum above 30.
- [ ] Test provider-calculated payer-fee display, financial rounding, exact net
  settlement to the merchant, refunds, and partial refunds.
- [ ] Test concurrent balance credit/deduction and webhook replay.
- [ ] Test receipt authorization and file validation.
- [ ] Test Sheet retry/idempotency and an unavailable Google API.
- [ ] Use an isolated database and disabled/test integrations for load testing.
- [ ] Load-test staged checkout at 10, 25, 50, and 100 concurrent submissions.
- [ ] Run `npx tsc --noEmit`, `npm run lint`, and `npm run build` before every
  phase is considered complete.
- [ ] Complete a staging acceptance checklist with the business owner before
  enabling real payments.

## Business decisions required before Phase 2 implementation

1. Are subscription durations exactly 5 through 30 days inclusive? What happens
   for 31+ days?
2. Do the new discount brackets apply to every package, including Sushka and
   Indiv? Do they replace the existing 2-day trial and special Sushka rules?
3. Can guests still place one-off full-price food orders, or must every customer
   register through Telegram before ordering anything?
4. Is a balance day tied to the purchased package, or can a client use it for a
   different package and pay the difference?
5. For bank transfer and cash, what happens if the admin rejects payment after
   the client has already consumed some credited days?
6. Which provider contractually supports a separately disclosed payer fee while
   settling the exact base invoice amount to the merchant? Do not imitate this
   in FoodBalance by increasing only the card price.
7. Does “the client selected dishes” mean after final checkout confirmation, or
   should every unfinished click/draft be persisted immediately?
8. Which exact Google Sheet is used for delivery, which is used for accounting
   checks, and which columns/templates must remain compatible with the existing
   bot workflow?
9. Should delivery time be sent automatically when saved, or after an explicit
   admin confirmation button?

## Deferred: gradual Google account migration

- [ ] Do not start until Railway production and all integrations are green.
- [ ] Add `foodbalancezp@gmail.com` as an owner/admin of the selected Google
  Cloud project where possible.
- [ ] Create a new OAuth web client and service account under the controlled
  business setup without deleting the old credentials.
- [ ] Copy or transfer Sheet ownership and grant the new service account editor
  access while the old integration remains active.
- [ ] Test new credentials in an isolated environment.
- [ ] Switch OAuth and Sheet credentials independently, verifying each step.
- [ ] Revoke old keys only after a successful observation period and rollback
  test.
- [ ] Treat the Telegram bot as a separate migration. Do not rotate or move the
  working bot merely because Google ownership changes.
