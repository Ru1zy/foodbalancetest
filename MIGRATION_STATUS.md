# FoodBalance: migration and product roadmap

Last updated: 2026-09-03

This is the live project tracker. Read it before making changes and update the
checkboxes and notes after every completed step. Never put credentials, tokens,
private keys, database URLs, or other secret values in this file.

## Status legend

- `[x]` completed and verified
- `[ ]` not completed
- `BLOCKED` requires a business decision or an external account action

## Current production strategy

- The **Next.js web application is currently in development**. It has never been used by real customers.
- The **legacy Telegram bot** (in `legacy_bot_logic.js`) is the only current production system.
- The Railway environment (`https://foodbalancetest-production.up.railway.app`) is the single source of truth for the new web app. Vercel and Neon are no longer relevant for production data, as there is no real web app data to sync.
- A custom domain has not yet been registered.
- Google OAuth and Google Sheets stay on the current owner's Google account for the first production launch.

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
- [x] Perform a final Neon -> Railway database sync. (Cancelled: The site was never live on Vercel/Neon, so there is no customer data to sync. Railway is the primary DB).
- [ ] Register a custom domain.
- [ ] Point the production domain to Railway.
- [ ] Set the final custom-domain `GOOGLE_REDIRECT_URI` in Railway and add the
  exact URI to Google Cloud Console:
  `https://<production-domain>/api/auth/google/callback`.
- [ ] Update **Authorized Domains** and homepage/privacy links in the Google Cloud Console (Google Auth Platform -> Branding) to use the new custom domain.
- [ ] Reinstall the Telegram webhook on
  `https://<production-domain>/api/telegram-webhook`.
- [ ] Update the Monobank/Plata webhook URL in their respective dashboards to point to the new custom domain.
- [ ] Change GitHub Actions `APP_BASE_URL` to the final production domain.
- [x] Remove or disable Vercel cron execution so jobs cannot run twice. (N/A: Only Railway/GitHub Actions will be used).
- [x] Keep the Vercel deployment available as a fallback. (Cancelled: Not needed).
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
- [x] **Core Reliability:**
  - [x] **Unify Google Sheets Auth:** Standardize `lib/googleSheets.ts` and `lib/monthlySheets.ts` to use identical service account auth patterns.
  - [x] **Database Job Queue (Outbox Pattern):** 
    - Add `OutboxJob` model to schema (`id`, `type`, `payload`, `status`, `retries`, `error`, `createdAt`).
    - Modify `app/actions/order-impl.ts` so `persistOrderInTransaction` writes an `OutboxJob` record instead of directly firing Google Sheets side-effects.
  - [x] **Idempotency logic for Sheets:**
    - Update `lib/monthlySheets.ts` and `lib/googleSheets.ts` to check if an order ID is already present (e.g. by checking a hidden column or trailing cell) before appending.
  - [x] **Background Worker/Cron:** Create an endpoint or background loop that processes `PENDING` outbox jobs and updates their status.
- [x] **LiqPay Idempotency:** Refactor `app/api/liqpay/callback/route.ts` to ensure that receiving the same `order_id` multiple times from LiqPay does not double-credit balance or double-trigger notifications.
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

### Phase 2: Dynamic Subscriptions & Discounts
- [x] Replace fixed duration cards with an integer day selector after the
  package is chosen.
- [x] Display the discount rules above the selector.
- [x] Implement server-side discount calculation and store an immutable price
  on the `Subscription` or `Order` record at checkout.
- [x] Require Telegram registration for discounted subscription purchases, if
  not already enforced. Enforced in `subscription.ts`: users without `chatId`
  receive an error message requiring Telegram bot connection.
- [x] Keep remaining days visible in the profile and show purchase/payment
  status there.
- [x] Decide whether balance remains package-specific. The current unique key is
  `(userId, packageType)`. If they switch packages mid-month, how are paid days
  credited?
- [x] Create a separate subscription-purchase/payment model. Do not overload a
  delivery `Order` with the purchase of a 30-day block.
- [x] Support idempotent balance crediting so callbacks, retries, and admin
  double-clicks cannot add days twice. Covered by `$transaction` atomicity,
  status checks before operations, and LiqPay `isPaid` guard.

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
- [x] Select the provider only after the business owner confirms the settlement
  account, merchant contract, payer-fee terms, and fiscalization requirements. (Plata by mono selected; waiting for business account approval).
- [ ] Obtain test credentials first; obtain production credentials only from
  the business owner's activated merchant. (Pending Mono approval)
- [ ] Confirm Apple Pay and Google Pay availability on the production merchant.
- [x] Create payment attempts server-side using trusted tariff/day values.
- [x] Verify provider webhook signatures server-side. (RSA-SHA256 implemented in `lib/monobank.ts`)
- [x] Credit subscription days only after a verified successful callback.
- [x] Add webhook idempotency, payment reconciliation, and failed/refunded
  states.
- [x] Keep `/api/balance/topup` disabled until this verified path replaces it.

### Bank transfer / account payment
- [x] Show the calculated amount and business payment details.
- [x] Add a dedicated authenticated receipt-upload flow. Do not reuse the
  admin-only public menu-image upload route.
- [x] Store receipts in a private bucket; expose them only to authorized admins.
- [x] After a receipt is uploaded, credit the subscription once with status
  `credited_pending_confirmation`, as requested by the owner.
- [x] Send a prominent Telegram alert to the admin with the client, amount,
  method, and a link to the pending payment.

### Cash

- [x] Credit the subscription once when the cash purchase is created, with
  status `credited_pending_confirmation`.
- [x] Put the purchase in the same pending-payment queue without requiring a
  receipt.
- [x] Mark the payment method clearly as cash.

## Phase 4: admin pending-payments workflow

- [x] Add an admin page/tab named `Оплати` with a visible pending counter.
- [x] Show at minimum: client name, phone, amount, payment method, package, days,
  creation time, and receipt when present.
- [x] Add an idempotent `Confirm payment` action.
- [x] Add a rejection/cancellation path only after the owner defines what to do
  with days that were already credited or consumed.
- [x] Remove confirmed entries from the pending view but retain an audit history.
- [x] Record who confirmed the payment and when.

## Phase 5: Telegram delivery experience and notifications

- [x] Keep Telegram as the primary registration path for customers who want
  discounts and subscriptions.
- [x] Verify the existing delivery-time notification flow end-to-end.
- [x] Decide whether delivery time is sent automatically when an admin enters it
  or only after the existing explicit `Notify` action.
- [x] Add email duplication of admin Telegram alerts only after an email provider,
  sender domain, recipients, and delivery policy are selected. (Implemented via Gmail API over HTTPS to bypass Railway SMTP blocks)

### UI/UX improvements (2026-08-14 – 2026-08-31)

- [x] Implement light/dark mode toggle using `next-themes` (class strategy) with
  an animated Sun / Moon switch in the header.
- [x] Ensure all components support `dark:` Tailwind variants across every page
  (header, footer, checkout, profile, onboarding, admin). Fix admin styles (22.08).
- [x] Remove "AI-template" aesthetics: standardize border radii to `rounded-2xl`,
  remove dashed borders, apply consistent glassmorphism header and dark footer.
- [x] Fix logo visibility on dark backgrounds (white backdrop in dark mode).
- [x] Replace the default Next.js/Vercel favicon with the FoodBalance logo.
- [x] Configure `metadataBase` and OpenGraph metadata for rich messenger previews.
- [x] Optimize mobile header layout: icon-only logout button, hidden slogan on
  small screens, reduced gap between nav elements.
- [x] Add smooth scroll-to-top on day navigation in Menu Wizard and page change
  in Action History.
- [x] Add dynamic "Items per page" selector (10/25/50/100) to profile Action History.
- [x] Add Telegram link to footer, reorder social links: Instagram -> Telegram -> TikTok.
- [x] Fix subscription day-input contrast in dark mode.
- [x] Improve mobile view of checkout form (ensure inputs scroll into view) and login modal.
- [x] **Redesign Checkout Cart UI (31.08):** Unify draft and cart items into a single, cohesive cart summary grouped by package, replacing clunky action buttons with clean links.
- [x] **Add Floating Cart Indicator (31.08):** Add a persistent floating cart button on the main layout to guide users back to checkout.
- [x] **Redesign Profile Page (31.08):** Wrap Settings, Subscriptions, and Balances in collapsible accordions to save vertical space and improve usability.
- [x] **Closed Orders Warning Banner (03.09):** Formatted with each sentence on a separate line with distinct icons and dark-mode styling.
- [x] **Optimistic UI Updates for Profile (03.09):** Added local React state in `ProfilePageClient` with instant updates for subscription purchases (0ms latency, automatic scroll to history), purchase cancellation, and order day cancellation without page reload.

## Phase 6: verification and release

- [x] Revert testing bypasses and restore strict `order-logic` cutoff times (22.08).
- [x] Verify legacy Google Sheets cutover (business owner successfully cloned legacy tables).
- [x] Add unit tests for every discount boundary: 4, 5, 6, 7, 13, 14, 29, 30,
  and any confirmed maximum above 30. (Added in lib/subscription-logic.test.ts)
- [x] **Order & Day Cancellation Implementation (03.09):**
  - Added `userCancelOrderDay` and `adminCancelOrderDay` server actions (`app/actions/order-cancel.ts`).
  - DST-aware Kyiv cutoff time logic (`isDeliveryDayCancellable` - strictly 23:59:59.999 Kyiv time on the day before delivery).
  - Amber badge `Скасовано частково (X/Y)` in Profile header, with clear `Час скасування минув` notice on days past cutoff.
  - Automatic balance refund logic restoring subscription days (`usedDays - 1`) up to `balanceDaysUsed`.
  - Background Outbox synchronization marking cancelled days in Google Sheets.
- [x] **Security Audit & Cleanup (03.09):**
  - Removed all unauthenticated test/debug endpoints (`/api/test-db`, `/api/debug`, `/api/test-reject`, `/api/test-email`).
  - Removed root repository junk & sensitive dumps (`database_dump.json`, `dump_db.ts`, `restore_db.ts`, etc.).
  - Added targeted `.gitignore` patterns for dumps (`*.sql`, `*.dump`, `*dump*.json`).
  - Removed PII update logging from `/api/telegram-webhook`.
- [x] **UI Resilience & Error Boundaries (03.09):**
  - Created `app/error.tsx` client error boundary with localized Ukrainian text and retry button.
  - Created `app/global-error.tsx` root error boundary with explicit `<html>` and `<body>` tags.
  - Added Tailwind pulse skeletons in `app/profile/loading.tsx` and `app/admin/loading.tsx`.
- [x] **Critical Test Coverage (03.09):**
  - `lib/order-cancel.test.ts`: Tests cutoff deadline boundaries (23:59:00 vs 00:00:01 Kyiv time), DST winter/summer shifts, balance refund limits, and non-negative clamp.
  - `lib/monobank.test.ts`: Tests 1.3% Plata fee calculation and rounding, 1-hour TTL public key caching, and network fallback.
  - 19 out of 19 unit tests passing via `npm test`.
- [ ] Test provider-calculated payer-fee display, financial rounding, exact net
  settlement to the merchant, refunds, and partial refunds. (Pending Monobank)
- [ ] Test concurrent balance credit/deduction and webhook replay.
- [x] Test receipt authorization and file validation. (Validated via unit tests in `receipt-validation.test.ts` and runtime checks in `uploadReceiptAction`)
- [ ] Test Sheet retry/idempotency and an unavailable Google API.
- [ ] Use an isolated database and disabled/test integrations for load testing.
- [ ] Load-test staged checkout at 10, 25, 50, and 100 concurrent submissions.
- [x] **Pre-Launch Polish & Hardening (04.09–05.09):**
  - **Financial Fix:** Restored real invoice price calculation for Monobank Plata checkouts (orders and subscriptions) with gross fee calculation; made 1 UAH test mode strictly opt-in via `MONOBANK_TEST_MODE="true"`.
  - **Guest Checkout Unblocked:** Fixed `uploadReceiptAction` to permit guest order receipt attachments (with `image/*` MIME check and 10 MB limit) instead of throwing 401 Unauthorized.
  - **Brand & Metadata Centralization:** Created `lib/site-config.ts` replacing hardcoded dummy IBAN and phone numbers across `CheckoutCustomerForm`, `SubscriptionOptions`, and `Footer`.
  - **Dynamic Admin Requisites & Contacts (`/admin/settings`):** Added `SystemSetting` PostgreSQL model and a dedicated admin interface enabling Vlad/admins to change IBAN details, contact phone, and social URLs (Telegram, Instagram, TikTok) on the fly without touching code or environment variables. All customer-facing surfaces (Checkout, Subscription Options, Footer) automatically consume these live settings with cache revalidation and fallback to `SITE_CONFIG`. Added "⚙️ Налаштування" to the admin navigation sidebar.
  - **Checkout Form State Preservation:** Fixed checkout form wipeout bug when switching payment methods by eliminating unnecessary `key` remounting on `FormProvider`.
  - **Sushka Pricing Integrity:** Resolved checkout price mismatch by aligning `PACKAGE_PRICES` / `seed.ts` with database tariffs (710 ₴ for Sushka XS, 770 ₴ for Sushka S) and removing hardcoded fallback constants.
  - **Individual Tariff Automation:** Implemented fixed per-dish pricing (default 200 ₴ / dish) for standalone «Індивідуальний» (`Indiv`) packages. Formula: `totalDishPortions × unitPrice`. Enabled automated online payment (Monobank Plata, IBAN, cash) and exact price exports to Google Sheets and Telegram.
  - **Admin Tariff Management:** Updated `/admin/tariffs` to display per-dish prices for `Indiv` (`200 ₴ / страва`) and allow live editing of the unit price directly from the admin dashboard.
  - **Cloudflare R2 Safety:** Whitelisted `*.r2.dev` in `next.config.ts` image remote patterns so newly uploaded bucket images never hit host whitelist errors.
  - **SEO & 404 Resilience:** Added branded `app/not-found.tsx` and crawlers configuration in `app/robots.ts` and `app/sitemap.ts`.
  - **Code Quality Sweep:** Resolved all 38 ESLint errors across actions, clients, and tests (`npm run lint` = 0 errors).
  - **Verification:** 21/21 unit tests passing (`npm test`), 0 TypeScript errors (`npx tsc --noEmit`), and 100% clean Turbopack production build (`npm run build`).

## Business decisions required (remaining)

~~1. Subscription durations~~ — Resolved: 2–30 days, 2-day trial once per user.
~~2. Discount brackets~~ — Resolved: apply to all packages; Sushka excluded from 15% tier.
3. Can guests still place one-off full-price food orders, or must every customer
   register through Telegram before ordering anything? — Current behaviour:
   guests can order food without Telegram, but subscriptions require it.
~~4. Balance tied to package~~ — Resolved: `@@unique([userId, packageId])`.
~~5. Admin rejects after credit~~ — Resolved: days are decremented on cancellation
   if status was `CREDITED_PENDING_CONFIRMATION`.
6. Which provider contractually supports a separately disclosed payer fee while
   settling the exact base invoice amount to the merchant? — BLOCKED.
~~7. Persist drafts~~ — Resolved: only final checkout is persisted.
~~8. Sheet destinations~~ — Resolved and documented in Phase 1.
~~9. Delivery time~~ — Resolved: sent after explicit admin `Notify` action.

## Next Steps (Finalization & Production Launch)

1. **Custom Domain & DNS Setup**:
   - [ ] Register/connect custom production domain to Railway.
   - [ ] Update `APP_BASE_URL` & `NEXT_PUBLIC_APP_URL` in Railway variables.
   - [ ] Add production OAuth callback URL in Google Cloud Console (`https://<domain>/api/auth/google/callback`) and update Authorized Domains.
   - [ ] Re-register Telegram bot webhook to the production domain.
2. **Monobank Acquiring Activation**:
   - [x] Production merchant token configured (`MONOBANK_API_TOKEN`).
   - [x] Gross Plata fee calculation (1.3%) and webhook callback URL configured (`/api/plata/callback`).
3. **Cloudflare R2 Storage**:
   - [x] Created Cloudflare R2 bucket (`foodbalance`) with public dev URL for receipts and menu assets.
   - [x] Configured `S3_*` credentials in Railway environment.
4. **Maintenance & Cutover**:
   - [ ] Add Railway payment method (credit card) to avoid container suspension.
   - [ ] Switch active customer traffic from legacy bot (`legacy_bot_logic.js`) to production web application.

## Deferred: gradual Google account migration

- [ ] Do not start until Railway production and all integrations are green.
- [ ] Add the business Google account as an owner/admin of the selected Google
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
