# FoodBalance: migration and product roadmap

Last updated: 2026-08-09

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
- [x] Basic read-only load check: 100/100 successful requests, concurrency 10,
  p50 about 109 ms and p95 about 364 ms.
- [x] Railway usage reviewed. Nearly all current cost is baseline application
  RAM; CPU, egress, PostgreSQL, and volume costs are small. Hobby is expected to
  be around the USD 5 minimum at the current scale.

### Required before cutover

- [ ] Retest Google OAuth with an existing completed user. Expected result:
  the user reaches `/profile` without onboarding.
- [ ] Investigate the tested onboarding phone conflict before changing account
  linking: Railway finds an existing user with that normalized phone but with
  `chatId = null`. Compare that record with current Neon during the final sync;
  the Railway database is an earlier snapshot. Do not auto-merge accounts from
  a typed phone number without proof of ownership.
- [ ] Test Telegram login/deep-link flow without changing its implementation.
- [ ] Test an authenticated admin login.
- [ ] Test S3 image upload from the admin menu page and verify the resulting
  public URL.
- [ ] Test one non-production checkout end-to-end without real payment.
- [ ] Verify the order is persisted in PostgreSQL.
- [ ] Verify global CRM Sheet writes: `Info` and `Orders` tabs.
- [ ] Verify month/day Sheet writes configured through `SheetConfig`.
- [ ] Verify admin pages: orders, today, clients, menu, tariffs, and Sheets
  settings.
- [ ] Implement external logical PostgreSQL backups. Railway built-in volume
  backups are unavailable without Pro. Use a private backup destination and
  test an actual restore; database dumps contain PII and must never use the
  public image bucket.
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
- User balances already use `UserBalance(packageId, totalDays, usedDays)`.
- The profile already displays remaining days per package.

### Required corrections

- [ ] Store delivery days in a queryable per-day structure (recommended:
  normalized `OrderDay` rows linked to the parent `Order`). Currently the order
  has one earliest `deliveryDate` and the other days live only inside JSON.
- [ ] Correct `/admin/today` so every order appears on every selected delivery
  day, not only on its earliest `deliveryDate`.
- [ ] Ensure non-consecutive selections (for example Monday, Wednesday, Friday)
  retain their real calendar dates in PostgreSQL, admin screens, Telegram, and
  Sheets.
- [ ] Make external integrations reliable with a database outbox/job table and
  retries. `syncClientToSheet` and `appendOrderToSheet` are currently started
  without awaiting completion, so a process restart can lose the write.
- [ ] Add idempotency to each Sheet destination so retrying a job cannot create
  duplicate rows.
- [ ] Reconcile Google credential formats. Most Sheet code uses
  `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`, while one kitchen-export route
  expects `GOOGLE_SERVICE_ACCOUNT_KEY` JSON.
- [ ] Verify and document the purpose of all current Sheet destinations:
  `GOOGLE_SHEET_ID`, `EXTERNAL_SHEET_ID`, and month-specific `SheetConfig` IDs.
- [ ] Re-check the known Sushka server-side price-validation gap before payment
  work begins.

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

- plata by mono and LiqPay both advertise a standard 1.3% fee for Ukrainian
  cards and 2% for foreign cards. Confirm the exact merchant contract before
  implementation because provider pages and legacy method pages can disagree.
- WayForPay advertises 2%; Fondy advertises 2.2% for Ukrainian cards below
  UAH 500,000 monthly turnover. Plata and LiqPay are the current shortlist.
- Plata has a public test environment/token available without an activated
  acquiring terminal. Test-token checkout does not show Apple Pay or Google
  Pay, so wallets require a small final live smoke test with the owner's
  merchant followed by a refund.
- LiqPay issues separate sandbox and production key pairs per merchant and
  provides test cards without real settlement.
- BLOCKED: do not add `+1.3%` or another card-only surcharge to the customer.
  Current paragraph 65 of NBU Regulation No. 164 prohibits a merchant from
  charging an additional fee for a payment instrument and from setting a
  different cash versus cashless price. The business must absorb acquiring in
  its common pricing model and confirm fiscal/accounting treatment.

- [ ] Select plata by mono or LiqPay after the business owner confirms the
  settlement account, merchant contract, and fiscalization requirements.
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
- [ ] Test financial rounding and the 1.5% LiqPay fee.
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
6. How should acquiring cost be absorbed into the common tariff pricing? A
   card-only surcharge and different cash/cashless price must not be implemented
   under current NBU Regulation No. 164.
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
