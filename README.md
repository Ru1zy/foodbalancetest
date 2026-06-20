<div align="center">

# 🥗 FoodBalance

**A meal-subscription & delivery platform with a weekly menu wizard, prepaid day-balances, Telegram & Google integrations, and an admin back office.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2d3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Deploy: Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/)

**🇬🇧 [English](#-english)  ·  🇺🇦 [Українська](#-українська)**

</div>

---

## 🇬🇧 English

### Overview

**FoodBalance** is a full-stack web application for a healthy-meal subscription and delivery service. Customers pick a weekly package, choose dishes day by day through a guided **order wizard**, and pay either per order or from a **prepaid day-balance**. Orders flow automatically to the kitchen team via **Telegram notifications** and **Google Sheets**, while an **admin dashboard** handles the menu, tariffs, clients, and daily fulfillment.

The app runs as a regular web app and as a **Telegram Mini App (TMA)**, with sign-in via Telegram or Google.

### Key features

- 🧙 **Order wizard** — step-by-step flow: choose package → pick delivery days → assemble meals per day (standard sets or **Individual** custom assembly), with live per-day validation.
- 🛒 **Multi-package cart** — add several packages with quantities and check out in one fully transactional submission (all-or-nothing, no partial fulfillment).
- 💳 **Prepaid day-balances** — customers buy a package of days; each order atomically deducts days from the matching balance, with safe fiat (card/cash) fallback.
- 🔒 **Idempotent checkout** — duplicate submissions are detected and safely replayed, so a double click never creates double orders.
- 📲 **Telegram integration** — Telegram Mini App + bot, login via Telegram, and automatic order notifications to the kitchen/admin chat.
- 🔑 **Google integration** — Google OAuth sign-in and order export to Google Sheets for the operations team.
- 🍽️ **Kitchen export & daily view** — admin "today" view and a kitchen export endpoint that always agree on the day's order set (DST-aware, Kyiv-timezone correct).
- 🛠️ **Admin back office** — manage menu, tariffs, clients, daily orders, and broadcast messages ("megaphone").
- ⏰ **Scheduled jobs** — nightly cron to archive completed orders.

### Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions) |
| UI | React 19, Tailwind CSS 4, lucide-react / react-icons |
| Language | TypeScript 5 |
| State | Zustand (with persistence) |
| Forms & validation | react-hook-form + Zod |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | JWT sessions with `jose`; Telegram + Google OAuth |
| Integrations | Telegram Bot / TMA (`@twa-dev/sdk`), Google APIs (`googleapis`) |
| File storage | Vercel Blob |
| Hosting | Vercel (with Vercel Cron) |

### Data model (Prisma)

`User` · `UserBalance` (prepaid days per package) · `Menu` · `Tariff` · `Order` · `CheckoutIdempotency` · `AuthToken` · `MergeToken`

### Getting started

**Prerequisites:** Node.js **22.12+** (required by Prisma 7) and a PostgreSQL database.

```bash
# 1. Install dependencies (runs `prisma generate` via postinstall)
npm install

# 2. Configure environment
cp .env.example .env   # then fill in the values (see below)

# 3. Sync the database schema (this repo uses db push, not migrations)
npx prisma db push

# 4. (optional) Seed sample data
npx prisma db seed

# 5. Run the dev server
npm run dev            # http://localhost:3000
```

### Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build (`next build`) |
| `npm run start` | Run the production server |
| `npm run lint` | Lint with ESLint |

> 💡 Always validate with a **full `next build`** before deploying — `tsc --noEmit` can pass while the production build breaks.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Secret for signing JWT sessions |
| `CRON_SECRET` | Protects the cron endpoints |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_ADMIN_CHAT_ID` | Chat that receives order notifications |
| `TELEGRAM_WEBHOOK_SECRET` | Validates incoming Telegram webhooks |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `GOOGLE_REDIRECT_URI` | Google OAuth callback URL |
| `GOOGLE_SERVICE_ACCOUNT_KEY` / `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` | Service account for Sheets access |
| `GOOGLE_SHEET_ID` / `EXTERNAL_SHEET_ID` | Target spreadsheets |
| `GAS_WEBAPP_URL` | Google Apps Script web app endpoint |

### Deployment (Vercel)

1. Connect the repository to Vercel.
2. Add all environment variables in the project settings.
3. Run `npx prisma db push` against the production database.
4. Copy `vercel.json.example` → `vercel.json` to enable the nightly archive cron.
5. Register the Telegram webhook with the `TELEGRAM_WEBHOOK_SECRET` as `secret_token`.

### Project structure

```
app/        Next.js routes (wizard, checkout, profile, onboarding, admin, api, server actions)
components/  Shared UI components
lib/        Core logic: order/balance rules, order store, auth, Google & Telegram helpers
prisma/     Prisma schema & seed
public/     Static assets
```

---

## 🇺🇦 Українська

### Огляд

**FoodBalance** — це повноцінний вебзастосунок для сервісу підписки та доставки здорового харчування. Клієнти обирають тижневий пакет, складають страви день за днем через покроковий **майстер замовлення** і оплачують або за кожне замовлення, або з **передплаченого балансу днів**. Замовлення автоматично надходять кухні через **сповіщення в Telegram** і **Google Таблиці**, а **адмін-панель** керує меню, тарифами, клієнтами та щоденним виконанням.

Застосунок працює як звичайний вебзастосунок і як **Telegram Mini App (TMA)**, з входом через Telegram або Google.

### Ключові можливості

- 🧙 **Майстер замовлення** — покроковий процес: вибір пакета → вибір днів доставки → складання страв на кожен день (стандартні набори або **Індивідуальне** складання) з перевіркою валідності для кожного дня в реальному часі.
- 🛒 **Кошик на кілька пакетів** — додавайте кілька пакетів із кількістю та оформлюйте все в одній повністю транзакційній операції (усе або нічого, без часткового виконання).
- 💳 **Передплачений баланс днів** — клієнт купує пакет днів; кожне замовлення атомарно списує дні з відповідного балансу з безпечним переходом на оплату карткою/готівкою.
- 🔒 **Ідемпотентне оформлення** — повторні надсилання розпізнаються та безпечно відтворюються, тож подвійний клік ніколи не створить подвійне замовлення.
- 📲 **Інтеграція з Telegram** — Telegram Mini App + бот, вхід через Telegram і автоматичні сповіщення про замовлення в чат кухні/адміна.
- 🔑 **Інтеграція з Google** — вхід через Google OAuth та експорт замовлень у Google Таблиці для операційної команди.
- 🍽️ **Експорт для кухні та денний огляд** — адмін-перегляд «сьогодні» та ендпоінт експорту для кухні, які завжди узгоджені щодо набору замовлень дня (коректний київський час із урахуванням переходу на літній/зимовий).
- 🛠️ **Адмін-панель** — керування меню, тарифами, клієнтами, щоденними замовленнями та масовими розсилками («мегафон»).
- ⏰ **Заплановані задачі** — нічний cron для архівації виконаних замовлень.

### Технологічний стек

| Рівень | Технологія |
| --- | --- |
| Фреймворк | Next.js 16 (App Router, Server Actions) |
| Інтерфейс | React 19, Tailwind CSS 4, lucide-react / react-icons |
| Мова | TypeScript 5 |
| Стан | Zustand (зі збереженням) |
| Форми та валідація | react-hook-form + Zod |
| База даних | PostgreSQL через Prisma 7 (`@prisma/adapter-pg`) |
| Автентифікація | JWT-сесії на `jose`; Telegram + Google OAuth |
| Інтеграції | Telegram Bot / TMA (`@twa-dev/sdk`), Google APIs (`googleapis`) |
| Сховище файлів | Vercel Blob |
| Хостинг | Vercel (з Vercel Cron) |

### Модель даних (Prisma)

`User` · `UserBalance` (передплачені дні за пакетом) · `Menu` · `Tariff` · `Order` · `CheckoutIdempotency` · `AuthToken` · `MergeToken`

### Початок роботи

**Вимоги:** Node.js **22.12+** (необхідно для Prisma 7) та база даних PostgreSQL.

```bash
# 1. Встановити залежності (через postinstall запускається `prisma generate`)
npm install

# 2. Налаштувати оточення
cp .env.example .env   # потім заповніть значення (див. нижче)

# 3. Синхронізувати схему БД (цей репозиторій використовує db push, а не міграції)
npx prisma db push

# 4. (опційно) Заповнити тестовими даними
npx prisma db seed

# 5. Запустити сервер розробки
npm run dev            # http://localhost:3000
```

### Доступні скрипти

| Скрипт | Опис |
| --- | --- |
| `npm run dev` | Запуск сервера розробки |
| `npm run build` | Продакшн-збірка (`next build`) |
| `npm run start` | Запуск продакшн-сервера |
| `npm run lint` | Перевірка коду ESLint |

> 💡 Перед деплоєм завжди перевіряйте **повним `next build`** — `tsc --noEmit` може пройти, тоді як продакшн-збірка ламається.

### Змінні оточення

| Змінна | Призначення |
| --- | --- |
| `DATABASE_URL` | Рядок підключення до PostgreSQL |
| `AUTH_SECRET` | Секрет для підпису JWT-сесій |
| `CRON_SECRET` | Захист cron-ендпоінтів |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота |
| `TELEGRAM_ADMIN_CHAT_ID` | Чат, що отримує сповіщення про замовлення |
| `TELEGRAM_WEBHOOK_SECRET` | Перевірка вхідних вебхуків Telegram |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Облікові дані Google OAuth |
| `GOOGLE_REDIRECT_URI` | URL зворотного виклику Google OAuth |
| `GOOGLE_SERVICE_ACCOUNT_KEY` / `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` | Сервісний акаунт для доступу до Таблиць |
| `GOOGLE_SHEET_ID` / `EXTERNAL_SHEET_ID` | Цільові таблиці |
| `GAS_WEBAPP_URL` | Ендпоінт вебзастосунку Google Apps Script |

### Розгортання (Vercel)

1. Підключіть репозиторій до Vercel.
2. Додайте всі змінні оточення в налаштуваннях проєкту.
3. Виконайте `npx prisma db push` для продакшн-бази даних.
4. Скопіюйте `vercel.json.example` → `vercel.json`, щоб увімкнути нічний cron архівації.
5. Зареєструйте Telegram-вебхук з `TELEGRAM_WEBHOOK_SECRET` як `secret_token`.

### Структура проєкту

```
app/        Маршрути Next.js (майстер, оформлення, профіль, онбординг, адмін, api, server actions)
components/  Спільні UI-компоненти
lib/        Основна логіка: правила замовлень/балансу, стор замовлення, авторизація, помічники Google і Telegram
prisma/     Схема Prisma та сід
public/     Статичні файли
```

---

<div align="center">
<sub>Built with Next.js · Prisma · Telegram · Google · Vercel</sub>
</div>
