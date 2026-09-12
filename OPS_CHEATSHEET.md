# 🛠️ Шпаргалка адміністратора FoodBalance (Ops & Troubleshooting Guide)

> **Домен:** `foodbalance.com.ua`  
> **Резервний домен Railway:** `foodbalancetest-production-5092.up.railway.app`  
> **Оновлено:** Вересень 2026  

Цей документ — повна практична шпаргалка: де що зберігається, як влаштовані сервіси, що оновити після покупки нового домену та куди дивитися в разі збоїв.

---

## 🗺️ 1. Де що зберігається (Архітектура та компоненти)

| Компонент | Де розміщено | Для чого використовується | Де керувати / дивитися |
|---|---|---|---|
| **Хостинг додатку (Web App)** | **Railway** (сервіс `foodbalance`) | Next.js 16 (App Router), SSR, Server Actions, API routes. Порт `8080`. | [railway.app](https://railway.app/) → Project → Service → **Deployments / Logs** |
| **База даних** | **PostgreSQL на Railway** | Зберігає користувачів (`User`), замовлення (`Order`, `OrderDay`), баланси, тарифи, налаштування. | Railway → PostgreSQL service → **Data** (або підключення через DBeaver / Prisma Studio) |
| **Домен і DNS** | **Реєстратор домену / Cloudflare** | DNS-записи (`A`, `CNAME`, `ALIAS`). Направляє трафік на Railway. | Панель реєстратора або [dash.cloudflare.com](https://dash.cloudflare.com) |
| **SSL-сертифікат** | **Railway (Let's Encrypt) / Cloudflare** | HTTPS шифрування. | Railway Networking або Cloudflare SSL/TLS |
| **Telegram-бот** | **Telegram Bot API** (`@fooddevtestbot` / робочий бот) | Авторизація без пароля через Deep-link (`/start <token>`), адмінські сповіщення про замовлення. | [@BotFather](https://t.me/BotFather) та `/api/telegram-webhook` на сайті |
| **Google Авторизація** | **Google Cloud Console** | Вхід клієнтів в 1 клік через Google акаунт. | [console.cloud.google.com](https://console.cloud.google.com/) → APIs & Services → Credentials |
| **Google Таблиці (CRM)** | **Google Drive & Sheets** | Експорт замовлень у щомісячні таблиці доставок та імпорт старих клієнтів. | Сервісний акаунт `foodbalance@foodbalance-506313.iam.gserviceaccount.com` |
| **Оплата (Еквайринг)** | **Monobank (Plata by Mono)** | Прийом карткових оплат (Apple Pay, Google Pay, картки). | [web.monobank.ua](https://web.monobank.ua/) (Кабінет мерчанта) |
| **Сховище медіа (S3/R2)** | **Cloudflare R2** | Фотографії страв меню, аватарки та чеки оплат. | [dash.cloudflare.com](https://dash.cloudflare.com) → R2 Object Storage |

---

## 🔑 2. Змінні оточення (Railway Variables Reference)

Усі секрети зберігаються в **Railway → Сервіс бекенду → Variables**.

### Обов'язкові змінні:
- `DATABASE_URL` — рядок підключення до PostgreSQL (формат: `postgresql://postgres:...@.../railway`).
- `APP_BASE_URL` — головний публічний URL сайту: **`https://foodbalance.com.ua`**. (Використовується всюди для формування посилань, вебхуків та редиректів. Додаткову змінну `NEXT_PUBLIC_APP_URL` створювати не обов'язково — код автоматично бере `APP_BASE_URL`).
- `TELEGRAM_BOT_TOKEN` — токен бота від @BotFather.
- `TELEGRAM_ADMIN_CHAT_ID` — Chat ID адміністраторів через кому (наприклад: `300333050,366707827,729923101`). **Захищає адмінів від видалення та дає доступ до `/admin`**.
- `TELEGRAM_WEBHOOK_SECRET` — секретний токен для захисту вебхука Telegram від підробки запитів.
- `MONOBANK_API_TOKEN` — токен мерчанта Monobank.
- `GOOGLE_CLIENT_ID` та `GOOGLE_CLIENT_SECRET` — облікові дані для Google Auth.
- `GOOGLE_CLIENT_EMAIL` та `GOOGLE_PRIVATE_KEY` — ключ сервісного акаунту для читання/запису Google Таблиць.
- `GOOGLE_SHEET_ID` — ID таблиці CRM для імпорту клієнтів.

---

## 🚀 3. Що зробити після покупки нового домену `foodbalance.com.ua`

### Крок 1. Оновити змінні в Railway
У [Railway Dashboard](https://railway.app/) → сервіс додатку → **Variables**:
1. `APP_BASE_URL` = `https://foodbalance.com.ua` (вона у вас вже є у списку!).
2. Якщо налаштовано Google Drive: `GOOGLE_DRIVE_REDIRECT_URI` = `https://foodbalance.com.ua/api/admin/google-drive/callback`
3. Натиснути кнопку **«Deploy / Apply change»**.

*(Після збереження Railway сам автоматично перезапустить контейнер за 1–2 хвилини).*

### Крок 2. Оновити Webhook для Telegram-бота
Telegram надсилає оновлення лише на зареєстровану адресу.
- **Спосіб А (найпростіший):** Зайти на сайті в `/admin/settings` у блок **«Синхронізація та інтеграції»** і натиснути кнопку **«Оновити Webhook Telegram»**.
- **Спосіб Б (вручну в браузері):**
  Відкрити посилання (підставивши свій токен і секрет):
  ```text
  https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://foodbalance.com.ua/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
  ```
  *Відповідь має бути:* `{"ok":true,"result":true,"description":"Webhook was set"}`.

### Крок 3. Додати домен в Google Cloud Console (для входу через Google)
Без цього при натисканні «Увійти через Google» буде помилка `redirect_uri_mismatch`:
1. Відкрийте [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Відкрийте ваш **OAuth 2.0 Client ID** (Web application).
3. У полі **Authorized JavaScript origins** додайте:
   - `https://foodbalance.com.ua`
   - `https://www.foodbalance.com.ua`
4. У полі **Authorized redirect URIs** додайте:
   - `https://foodbalance.com.ua/api/auth/google/callback`
   - `https://www.foodbalance.com.ua/api/auth/google/callback`
5. Натисніть **Save** (зберігається 2–5 хвилин).

### Крок 4. Monobank (Plata by Mono)
- **Нічого вручну налаштовувати не потрібно!**
- Наш бекенд при кожному створенні рахунку автоматично передає актуальний `webHookUrl: https://foodbalance.com.ua/api/plata/callback` та `redirectUrl: https://foodbalance.com.ua/profile`. Щойно оновлено `APP_BASE_URL`, нові оплати одразу підуть через новий домен.

---

## 🧹 4. Що робити з базою перед офіційним стартом?

Якщо під час тестів було створено фейкові замовлення або тестових користувачів:

1. **Не запускайте сайт зі спамом у БД:** Старі тестові замовлення будуть плутати кур'єрів у щоденних звітах (`/admin/today`) та вивантажуватися в CRM таблицю.
2. **Як очистити:**
   - Відкрийте панель управління: **`/admin/settings`**.
   - Прокрутіть донизу до блоку **«Очищення тестових даних (Danger Zone)»**.
   - Доступно три кнопки:
     - 🟡 **«Очистити замовлення»** — видаляє всі замовлення, дні доставок, історію покупок підписок та скидає баланси. Акаунти користувачів не чіпає.
     - 🔴 **«Очистити клієнтів (крім адмінів)»** — видаляє всіх зареєстрованих клієнтів, **але захищає всіх адмінів**, чий `chatId` прописаний у `TELEGRAM_ADMIN_CHAT_ID`.
     - 💥 **«Повне очищення БД»** — стирає всі тестові замовлення та всіх користувачів, окрім адміністраторів. База стає кришталево чистою для старту.
3. **Імпорт клієнтів зі старої CRM:**
   - Після очищення натисніть **«Імпортувати клієнтів»** у блоці вище.
   - Система перенесе клієнтів, які мають Chat ID (ПІБ, телефон, адресу, пакет).
   - Коли такий клієнт зайде на сайт через Telegram — він одразу впізнається системою без конфліктів.

---

## 🚑 5. Що робити при збоях (Troubleshooting Runbook)

### Сценарій А: Сайт видає «ERR_TOO_MANY_REDIRECTS» (Циклічний редирект)
- **Де проблема:** Налаштування Cloudflare SSL/TLS.
- **Причина:** Cloudflare звертається до Railway по HTTP (порт 80), а Railway перенаправляє на HTTPS.
- **Як полагодити:**
  1. Зайдіть у [Cloudflare](https://dash.cloudflare.com/) → виберіть `foodbalance.com.ua`.
  2. Перейдіть у меню **SSL/TLS** → **Overview**.
  3. Змініть режим шифрування з **Flexible** на **Full** або **Full (Strict)**.
  4. Зачекайте 1 хвилину — редиректи зникнуть.

### Сценарій Б: Сайт видає «502 Bad Gateway» або «Application Error»
- **Де проблема:** Процес Next.js на Railway впав або не може запуститися.
- **Куди дивитися:**
  1. Відкрийте [Railway Dashboard](https://railway.app/).
  2. Натисніть на сервіс додатку → вкладка **Deployments** → виберіть поточний активний деплой → натисніть **View Logs**.
  3. Шукайте червоні помилки в логах.
- **Типові причини:**
  - `PrismaClientInitializationError: Can't reach database server`: впала база PostgreSQL на Railway або неправильний `DATABASE_URL`.
  - Змінна середовища містить синтаксичну помилку (наприклад, незакриті лапки в приватному ключі).

### Сценарій В: Бот не відповідає на кнопку «Увійти через Telegram» (мовчить після переходу)
- **Куди дивитися:**
  1. Перевірте статус вебхука: відкрийте в браузері:
     ```text
     https://api.telegram.org/bot<ВАШ_ТОКЕН>/getWebhookInfo
     ```
  2. Подивіться поле `url` (має бути `https://foodbalance.com.ua/api/telegram-webhook`) та `last_error_message`.
  3. Якщо `url` веде на старий домен або пустий — оновіть вебхук у `/admin/settings`.
  4. Якщо помилка `wrong secret token` — перевірте, чи збігається `TELEGRAM_WEBHOOK_SECRET` у Railway з тим, що передавався в `setWebhook`.

### Сценарій Г: Помилка «redirect_uri_mismatch» при вході через Google
- **Причина:** Новий домен не внесено до білого списку в Google Cloud Console.
- **Як полагодити:**
  1. Відкрийте [Google Cloud Console](https://console.cloud.google.com/) → Credentials → ваш OAuth Client.
  2. Додайте в **Authorized redirect URIs**: `https://foodbalance.com.ua/api/auth/google/callback`.
  3. Додайте в **Authorized JavaScript origins**: `https://foodbalance.com.ua`.
  4. Збережіть та зачекайте 3 хвилини.

### Сценарій Д: Оплата в Monobank пройшла успішно, але баланс не нарахувався
- **Куди дивитися:**
  1. Відкрийте логи Railway та знайдіть запити на `/api/plata/callback`.
  2. У базі даних перевірте таблицю `SubscriptionPurchase` (чи статус змінився з `PENDING` на `PAID`).
  3. Перевірте, чи не заблокований вхід на сайт Cloudflare WAF (іноді Cloudflare блокує IP-адреси вебхуків Monobank, якщо увімкнено режим Under Attack).
- **Як терміново допомогти клієнту:**
  - Зайдіть в `/admin` → вкладка клієнтів або замовлень → відкрийте клієнта і вручну додайте дні підписки через інтерфейс адміністратора.

### Сценарій Е: Замовлення не потрапляють у Google Таблицю
- **Куди дивитися:**
  1. Відкрийте `/admin/settings` або `/admin/settings/sheets`.
  2. Перевірте, чи є рядок для поточного місяця (наприклад, `09.2026`). Якщо місяць змінився, а адміністратор не додав нову таблицю — додаток тимчасово не може експортувати туди замовлення.
  3. Перевірте, чи надано доступ **Редактора** на цю Google Таблицю сервісному акаунту `foodbalance@foodbalance-506313.iam.gserviceaccount.com`.

---

## 🔒 6. Резервні копії (Backups)

- **PostgreSQL на Railway:** Railway автоматично створює щоденні бекапи бази (вкладка **Backups** у сервісі PostgreSQL).
- **Ручний дамп перед важливими оновленнями:**
  Можна зняти повний дамп через команду `pg_dump`:
  ```bash
  pg_dump "<DATABASE_URL>" > backup_$(date +%Y%m%d).sql
  ```
  Детальний регламент резервного копіювання описано у файлі `DATABASE_BACKUP_RUNBOOK.md`.

---

## ⚡ 7. Специфічні механізми платформи (Швидка довідка)

### А. Генератор платіжних посилань Monobank в адмінці (`/admin/orders`)
- **Як влаштовано:** Адміністратор натискає кнопку «💳 Посилання Mono», система генерує ключ виду `admin_inv_${orderId}_${timestamp}`, зв'язує його в таблиці `CheckoutIdempotency` з усіма вибраними замовленнями і викликає `createMonobankInvoice`.
- **Автоматичний вебхук:** При оплаті Monobank надсилає `POST /api/plata/callback`. Код визначає префікс `admin_inv_`, пропускає формульні перевірки недоплати (оскільки суму вручну встановив адмін), масово проставляє `isPaid: true` та `paymentMethod: "plata"` для всіх замовлень у чеку, оновлює статус у Google Sheets та надсилає клієнту сповіщення в Telegram.

### Б. Захист від спаму та перебору кодів (OTP Rate Limiting)
- **Обмеження запитів:** `otpRequestLimiter` дозволяє 1 відправку коду на 60 секунд (перевіряється окремо за `userId` та за нормалізованим номером телефону).
- **Захист від підбору (Brute-force):** `otpGuessLimiter` дає максимум 5 спроб введення 6-значного коду. При вичерпанні блокує введення та повторний запит на **15 хвилин**.
- **Захист при зміні номера:** Блокування за номером телефону (`normalizedPhone`) фіксується окремо від акаунта. Якщо шахрай намагається перебирати коди для чужого номера з різних акаунтів або перемикає свій номер — система миттєво блокує запити саме на цей цільовий номер.

### В. Модульний лічильник калоражу Sport Active+ (до 3400 ккал)
- **Логіка:** Для раціону Sport Active+ доступний модульний лічильник калоражу в кошику: від 2400 ккал (базовий) до 3400 ккал (+1000 ккал, ліміт 10 кліків).
- **Ціна:** Кожні +100 ккал додають **+35 ₴ на кожен день** раціону. Наприклад, для 2700 ккал: `850 + 105 = 955 ₴/день`.
- **Синхронізація:** У базі `Order.items` зберігається `extraKcal`, у коментар замовлення автоматично дописується `[Калораж: 2700 ккал (+300 ккал/день)]`, у Google Sheets (колонка G) виводиться `Sport (2700 ккал)`, а Telegram надсилає кухарям та адмінам повне розшифрування калоражу.

### Г. Керування додатковими опціями та допами (`/admin/tariffs`)
- **Розташування:** Під таблицею тарифів є модуль «⚡ Модульні допи та модифікатори».
- **Додавання:** Кнопка `+ Додати доп` розгортає форму додавання: назва, прив'язка (*Загальний для всіх* або *Окремий для раціону*), ціна в ₴, періодичність (*за день*, *за 100 ккал*, *за порцію*, *фіксована*), макс. ліміт кроків та опис.
- **Збереження:** Конфігурація зберігається в базі даних (`package_addons_config`), дозволяє миттєво вмикати/вимикати опції перемикачем, редагувати ✏️ та видаляти 🗑️ без перезапуску сервера.


