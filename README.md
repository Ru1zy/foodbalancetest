<div align="center">

# 🥗 FoodBalance

**Сервіс підписки та доставки збалансованого харчування у м. Запоріжжя**  
**Healthy meal subscription & delivery platform with an order wizard, prepaid day-balances, Monobank acquiring, Telegram & Google integrations, and an admin back office.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2d3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Monobank](https://img.shields.io/badge/Payment-Monobank%20Plata-ff4b4b)](https://www.monobank.ua/)
[![Deploy: Railway](https://img.shields.io/badge/Deploy-Railway-black?logo=railway)](https://railway.app/)

**🇬🇧 [English](#-english)  ·  🇺🇦 [Українська](#-українська)**

</div>

---

## 🇬🇧 English

### Overview

**FoodBalance** is a production-grade, full-stack web application built for a healthy-meal delivery service in Zaporizhzhia, Ukraine ([@food.balance.zp](https://instagram.com/food.balance.zp)). 

Customers choose a nutrition program (**Slim**, **Balance**, **Active**, **Sport**, specialized **Sushka Light**, or a custom **Individual** meal builder), select delivery days, customize dishes day by day through a guided **order wizard**, and pay securely online via **Monobank acquiring (Plata)**, bank transfer, cash, or atomically deduct days from a **prepaid subscription balance**.

Orders sync in real time to the kitchen team via **Telegram bot alerts**, **Google Sheets**, and an **interactive admin dashboard** for daily kitchen and courier fulfillment.

The platform works as a responsive web app and as a **Telegram Mini App (TMA)**, supporting one-click sign-in via Telegram or Google OAuth.

---

### Key Features

- 🧙 **Order Wizard** — multi-step guided experience: choose nutrition package → select delivery days → assemble meals per day with live validation and dish details.
- 💳 **Monobank Acquiring (Plata)** — seamless online card checkout (Apple Pay / Google Pay / cards) with automatic payment status webhooks and cryptographic ECDSA/SHA-256 signature verification.
- 🎟️ **Prepaid Day-Balances & Subscriptions** — customers buy meal packages upfront at tiered discount rates (-5%, -10%, -15%); each order atomically deducts days from their active balance.
- 🛒 **Multi-Package Cart** — add several packages and quantities in one transaction with safe rollback on payment cancellation.
- 🔒 **Idempotent Checkout** — duplicate submission guards guarantee a double click never charges or creates duplicate orders.
- 📲 **Telegram Mini App & Bot** — native TMA experience (`@twa-dev/sdk`), passwordless Telegram login, and instant order broadcast notifications to kitchen & manager chat groups.
- 🔑 **Google Ecosystem Integration** — Google OAuth 2.0 customer sign-in, real-time Google Sheets two-way order sync, and automated monthly Google Drive spreadsheet generation with AES-256 encrypted refresh tokens.
- 🍽️ **Kitchen & Courier Daily View** — dedicated admin dashboard and export endpoints synchronized with Europe/Kyiv timezone (DST-aware).
- 🛠️ **Admin Management Suite** — comprehensive back office for tariffs, weekly menus, promo marketing materials/flyers, client balances, and mass broadcasts.
- ☁️ **Cloudflare R2 / S3 Storage** — high-performance S3-compatible cloud storage for meal photos and marketing flyers.
- 🎨 **Modern Design & Dark Mode** — fluid responsive layout, glassmorphism, tailored typography, and a seamless light/dark theme switch.
- 🧪 **Automated Testing** — test suite with Jest verifying checkout idempotency, balance deduction, and Monobank integration.

---

### Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions, Turbopack) |
| UI | React 19, Tailwind CSS 4, Lucide React, react-icons |
| Language | TypeScript 5 |
| Payments | Monobank Acquiring (Plata API) |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| State | Zustand (with localStorage persistence) |
| Forms & validation | react-hook-form + Zod |
| Auth & Security | JWT sessions (`jose`), Telegram Auth, Google OAuth, AES-256 encryption |
| Cloud Storage | Cloudflare R2 / S3 (`@aws-sdk/client-s3`) |
| Integrations | Telegram Bot / TMA (`@twa-dev/sdk`), Google Sheets & Drive (`googleapis`) |
| Testing | Jest, ts-jest, React Testing Library |
| Theming | `next-themes` (class strategy, light/dark modes) |
| Hosting & Cron | Railway (primary host), GitHub Actions (automated cron) |

---

### Data Model (Prisma)

- **`User`** — customer profile, contacts, default delivery address, cutlery preference, delivery notes.
- **`UserBalance`** — prepaid day balances grouped by package type.
- **`SubscriptionPurchase`** — subscription purchase history and payment tracking.
- **`Tariff`** — package rules, pricing, calories, flyer images, and meal configuration.
- **`Menu`** — weekly scheduled dish choices per package and day.
- **`Order` & `OrderDay`** — orders, delivery dates, dish selections, and fulfillment statuses.
- **`CheckoutIdempotency`** — anti-duplicate submission transaction records.
- **`GoogleDriveConnection`** — encrypted Drive OAuth credentials for monthly spreadsheets.
- **`AdminSettings` & `PromoMaterial`** — dynamic flyers, promotional materials, and site config.
- **`OutboxJob`** — reliable asynchronous delivery for external webhooks and notifications.

---

### Getting Started

**Prerequisites:** Node.js **22.12+** (required by Prisma 7) and a PostgreSQL database.

```bash
# 1. Install dependencies (triggers prisma generate via postinstall)
npm install

# 2. Configure environment variables
cp .env.example .env   # fill in your values (see table below)

# 3. Sync database schema
npx prisma db push

# 4. (Optional) Seed initial tariff and promo data
npx prisma db seed

# 5. Run tests
npm test

# 6. Start development server
npm run dev            # http://localhost:3000
```

---

### Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Starts local Next.js development server |
| `npm run build` | Builds optimized production bundle (`next build`) |
| `npm run start` | Runs built production server |
| `npm run lint` | Checks code formatting and ESLint rules |
| `npm test` | Runs Jest unit and integration test suite |

> 💡 Always validate with **`npm run build`** before pushing code — Next.js production builds verify strict server action rules and route configurations.

---

### Environment Variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL |
| `AUTH_SECRET` | Secret key used to sign and verify customer JWT sessions |
| `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` | Public production base URL (e.g. `https://your-domain.railway.app`) |
| `MONOBANK_API_TOKEN` | Merchant token from Monobank Plata dashboard |
| `PLATA_FEE_PERCENT` | Gateway acquiring fee percentage (default: `0.013` = 1.3%) |
| `TELEGRAM_BOT_TOKEN` | Token for the Telegram Bot |
| `TELEGRAM_ADMIN_CHAT_ID` | Comma-separated list of Telegram chat IDs for order notifications |
| `TELEGRAM_WEBHOOK_SECRET` | Secret token to authenticate Telegram webhook calls |
| `NEXT_PUBLIC_BOT_USERNAME` | Telegram Bot username (without `@`) for Mini App links |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 credentials for customer sign-in |
| `GOOGLE_REDIRECT_URI` | Google OAuth callback URL (`/api/auth/google/callback`) |
| `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` | Service Account credentials for Google Sheets operations |
| `GOOGLE_SHEET_ID` | Global CRM spreadsheet ID (`Info` & `Orders` sheets) |
| `EXTERNAL_SHEET_ID` | Kitchen/delivery daily export spreadsheet ID |
| `GOOGLE_DRIVE_CLIENT_ID` / `SECRET` | Admin OAuth client for monthly Drive spreadsheet generator |
| `GOOGLE_DRIVE_REDIRECT_URI` | Callback URL: `/api/admin/google-drive/callback` |
| `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` | Base64-encoded 32-byte AES key for encrypting Drive refresh token |
| `S3_ENDPOINT` | S3-compatible storage API endpoint (Cloudflare R2, Supabase, MinIO) |
| `S3_BUCKET` | S3 bucket name for dish and flyer uploads |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | S3 access keys |
| `S3_PUBLIC_BASE_URL` | Public CDN URL prefix for stored files |
| `CRON_SECRET` | Secret bearer token protecting scheduled `/api/cron/*` endpoints |
| `SMTP_EMAIL` / `SMTP_PASSWORD` | Optional SMTP credentials for email delivery |

---

### Deployment on Railway

The application is deployed on **Railway**:

1. **Create Project**: Connect this GitHub repository to Railway.
2. **Add Database**: Provision a Railway PostgreSQL database service. The `DATABASE_URL` variable will be linked automatically.
3. **Set Environment Variables**: In Railway service settings, add all required variables listed above.
4. **Deploy**: Railway runs `npm run build` and starts the app with `npm run start`.
5. **Database Sync**: If updating schema, run `npx prisma db push` (or configure a pre-deploy release command).
6. **Configure Webhooks**:
   - **Telegram**: Call `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_DOMAIN>/api/telegram-webhook&secret_token=<SECRET>`
   - **Monobank**: Monobank automatically registers the callback URL provided with each invoice (`/api/plata/callback`).
   - **Google OAuth**: Add `<YOUR_DOMAIN>/api/auth/google/callback` to authorized redirect URIs in Google Cloud Console.
7. **Automated Scheduled Jobs (Cron)**:
   - Configured via GitHub Actions in `.github/workflows/cron.yml`.
   - Set repository secrets in GitHub: `APP_BASE_URL` and `CRON_SECRET`.
   - Runs nightly order status checks and fulfillment archival.

---

### Project Structure

```
app/              Next.js routes (wizard, checkout, profile, admin, api, server actions)
components/       Shared UI components (PackageSelector, SubscriptionOptions, modals, theme)
lib/              Business logic (order rules, Monobank, Google APIs, Telegram, auth)
prisma/           Database schema (`schema.prisma`) and seed scripts
public/           Static images, flyers, and branding assets
tests/            Automated Jest test suite
```

---

## 🇺🇦 Українська

### Огляд

**FoodBalance** — це повнофункціональний вебзастосунок для сервісу щоденної доставки здорового та збалансованого харчування у м. Запоріжжя ([@food.balance.zp](https://instagram.com/food.balance.zp)).

Клієнти обирають раціон (**Slim**, **Balance**, **Active**, **Sport**, експрес-програму **Сушка Light** або персональний конструктор **Індивідуальний**), обирають дні доставки, гнучко налаштовують меню день за днем через зручний **майстер замовлення** та безпечно оплачують карткою онлайн через **інтернет-еквайринг Monobank (Plata)**, банківським переказом, готівкою або списують дні з **передплаченого балансу абонемента**.

Замовлення миттєво надходять команді кухні та менеджеру через **сповіщення Telegram-бота**, експортуються у **Google Таблиці** та відображаються в інтерактивній **адмін-панелі**.

Застосунок працює як звичайний вебсайт і як **Telegram Mini App (TMA)**, підтримуючи швидкий вхід в один клік через Telegram або Google.

---

### Ключові можливості

- 🧙 **Майстер замовлення** — покроковий процес: вибір пакета → вибір днів доставки → складання страв на кожен день з онлайн-перевіркою та підрахунком КБЖВ.
- 💳 **Еквайринг Monobank (Plata)** — швидка онлайн-оплата картками, Apple Pay та Google Pay, автоматична обробка вебхуків та перевірка криптографічного цифрового підпису (ECDSA/SHA-256).
- 🎟️ **Передплачені абонементи та баланс днів** — придбання пакетів днів зі знижками (-5%, -10%, -15%); кожне замовлення атомарно списує дні без ризику подвійного списання.
- 🛒 **Кошик на кілька пакетів** — можливість додавати кілька різних раціонів в одне замовлення з безпечним поверненням у разі скасування.
- 🔒 **Ідемпотентне оформлення** — надійний захист від дублювання: навіть багаторазовий клік ніколи не створить повторне списання коштів чи дублікат замовлення.
- 📲 **Telegram Mini App та бот** — безшовна робота всередині Telegram через `@twa-dev/sdk`, вхід без паролів та миттєві сповіщення кухні/адміністратора про нові замовлення.
- 🔑 **Інтеграція з Google** — авторизація через Google OAuth 2.0, двостороння синхронізація з Google Таблицями та автоматичне створення щомісячних книг на Google Диску із захищеним шифруванням токенів (AES-256).
- 🍽️ **Щоденний експорт для кухні та кур'єрів** — окремий адмін-модуль «сьогодні» та ендпоінти вивантаження з точним урахуванням київського часу (Europe/Kyiv) та переходу на літній/зимовий час.
- 🛠️ **Адмін-панель** — повне керування меню, тарифами, промо-матеріалами та флаєрами, балансами користувачів та розсилками («Мегафон»).
- ☁️ **Хмарне сховище Cloudflare R2 / S3** — швидке завантаження та роздача фотографій страв і рекламних матеріалів.
- 🎨 **Сучасний дизайн та темна тема** — плавна адаптивна верстка, гласморфізм, продумана типографіка та перемикання світлої/темної теми.
- 🧪 **Автоматизовані тести** — набір тестів на базі Jest для перевірки логіки оплат, списання балансів та ідемпотентності.

---

### Технологічний стек

| Рівень | Технологія |
| --- | --- |
| Фреймворк | Next.js 16 (App Router, Server Actions, Turbopack) |
| Інтерфейс | React 19, Tailwind CSS 4, Lucide React, react-icons |
| Мова | TypeScript 5 |
| Оплата | Monobank Acquiring (API Plata) |
| База даних | PostgreSQL через Prisma 7 (`@prisma/adapter-pg`) |
| Стан | Zustand (зі збереженням у localStorage) |
| Форми та валідація | react-hook-form + Zod |
| Безпека та Auth | JWT-сесії (`jose`), Telegram Auth, Google OAuth, AES-256 |
| Хмарне сховище | Cloudflare R2 / S3 (`@aws-sdk/client-s3`) |
| Інтеграції | Telegram Bot / TMA (`@twa-dev/sdk`), Google Sheets & Drive (`googleapis`) |
| Тестування | Jest, ts-jest, React Testing Library |
| Теми оформлення | `next-themes` (класова стратегія, light/dark) |
| Хостинг і Cron | Railway (основний продакшн), GitHub Actions (автоматичний cron) |

---

### Початок роботи

**Вимоги:** Node.js **22.12+** (вимога Prisma 7) та база даних PostgreSQL.

```bash
# 1. Встановити залежності (після інсталяції автоматично запускається prisma generate)
npm install

# 2. Налаштувати змінні оточення
cp .env.example .env   # заповніть параметри згідно таблиці нижче

# 3. Синхронізувати схему бази даних
npx prisma db push

# 4. (Опційно) Наповнити базовими тарифами та налаштуваннями
npx prisma db seed

# 5. Запустити тести
npm test

# 6. Запустити сервер розробки
npm run dev            # http://localhost:3000
```

---

### Доступні скрипти

| Скрипт | Опис |
| --- | --- |
| `npm run dev` | Запуск сервера розробки |
| `npm run build` | Оптимізована продакшн-збірка (`next build`) |
| `npm run start` | Запуск зібраного продакшн-сервера |
| `npm run lint` | Перевірка коду через ESLint |
| `npm test` | Запуск тестів Jest |

---

### Змінні оточення

| Змінна | Призначення |
| --- | --- |
| `DATABASE_URL` | Рядок підключення до PostgreSQL |
| `AUTH_SECRET` | Секретний ключ для підпису JWT-сесій клієнтів |
| `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` | Публічний URL сайту (наприклад, `https://foodbalance.up.railway.app`) |
| `MONOBANK_API_TOKEN` | Токен мерчанта з кабінету еквайрингу Monobank Plata |
| `PLATA_FEE_PERCENT` | Комісія еквайрингу (за замовчуванням `0.013` = 1.3%) |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота |
| `TELEGRAM_ADMIN_CHAT_ID` | ID чатів адмінів/кухні для сповіщень (через кому) |
| `TELEGRAM_WEBHOOK_SECRET` | Секретний токен перевірки вебхуків Telegram |
| `NEXT_PUBLIC_BOT_USERNAME` | Юзернейм бота без `@` для посилань Mini App |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Ключі Google OAuth 2.0 для входу клієнтів |
| `GOOGLE_REDIRECT_URI` | Callback-адреса Google OAuth (`/api/auth/google/callback`) |
| `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` | Сервісний акаунт для роботи з Google Таблицями |
| `GOOGLE_SHEET_ID` | ID головної таблиці CRM (вкладки `Info` та `Orders`) |
| `EXTERNAL_SHEET_ID` | ID таблиці експорту для кухні та кур'єрів |
| `GOOGLE_DRIVE_CLIENT_ID` / `SECRET` | OAuth-клієнт для генератора щомісячних книг на Google Диску |
| `GOOGLE_DRIVE_REDIRECT_URI` | Callback-адреса: `/api/admin/google-drive/callback` |
| `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` | Base64-ключ (32 байти) для AES-256 шифрування токена Drive |
| `S3_ENDPOINT` | API ендпоінт S3-сховища (Cloudflare R2, Supabase, MinIO) |
| `S3_BUCKET` | Назва бакета для завантаження зображень |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Ключі доступу до S3 |
| `S3_PUBLIC_BASE_URL` | Публічний URL для доступу до файлів через CDN |
| `CRON_SECRET` | Токен для захисту викликів розкладу `/api/cron/*` |
| `SMTP_EMAIL` / `SMTP_PASSWORD` | Дані поштового сервера (опційно) |

---

### Розгортання на Railway

Проєкт повністю налаштовано для роботи на **Railway**:

1. **Підключення репозиторію**: Створіть новий проєкт на Railway та виберіть цей GitHub-репозиторій.
2. **База даних**: Додайте сервіс PostgreSQL у Railway. Змінна `DATABASE_URL` прив'язується автоматично.
3. **Налаштування оточення**: У налаштуваннях сервісу (Variables) додайте всі змінні з таблиці вище.
4. **Збірка**: Railway автоматично запустить `npm run build` і підніме додаток командою `npm run start`.
5. **Синхронізація БД**: При оновленні структури виконайте `npx prisma db push`.
6. **Налаштування вебхуків**:
   - **Telegram**: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL>/api/telegram-webhook&secret_token=<SECRET>`
   - **Monobank**: URL зворотного виклику передається автоматично при створенні рахунку (`/api/plata/callback`).
   - **Google OAuth**: Вкажіть `<URL>/api/auth/google/callback` у дозволених redirect URI в Google Cloud Console.
7. **Автоматичні задачі (Cron)**:
   - Задачі виконуються через GitHub Actions (`.github/workflows/cron.yml`).
   - Додайте секрети `APP_BASE_URL` та `CRON_SECRET` у налаштуваннях GitHub репозиторію.
   - Розклад запускає щонічну архівацію та перевірку статусів замовлень.

---

### Структура проєкту

```
app/              Маршрути Next.js (майстер замовлення, оплата, профіль, адмінка, API, server actions)
components/       Компоненти інтерфейсу (PackageSelector, SubscriptionOptions, модалки)
lib/              Логіка (правила замовлень, Monobank, Google API, Telegram, сесії)
prisma/           Схема бази даних (`schema.prisma`) та сід
public/           Статичні файли, фотографії страв та флаєри
tests/            Набір автоматичних тестів Jest
```

---

<div align="center">
<sub>Розроблено для FoodBalance · Next.js · Prisma · Monobank · Telegram · Google · Railway</sub>
</div>
