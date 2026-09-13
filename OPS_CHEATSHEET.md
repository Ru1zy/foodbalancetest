# 🛠️ Шпаргалка адміністратора FoodBalance (Ops, Variables & Troubleshooting Guide)

> **Головний домен:** `https://foodbalance.com.ua`  
> **Резервний домен Railway:** `foodbalancetest-production-5092.up.railway.app`  
> **Версія системи:** 2.2.1 (Вересень 2026)  
> **Призначення:** Довідник для швидкої навігації: де що зберігається, повний реєстр усіх змінних оточення (Railway та GitHub Secrets), що відкривати при збоях та як миттєво відновити роботу сервісів.

---

## 🗺️ 1. Карта сервісів та компонентів

| Компонент | Де розміщено | Для чого використовується | Що відкривати для перевірки / логів |
|---|---|---|---|
| **Веб-додаток (Next.js 16)** | **Railway** (сервіс `foodbalance`) | Next.js 16 App Router, SSR, Server Actions, API ендпоінти. Порт `8080`. | [railway.app](https://railway.app/) → Project → Service → **Deployments / View Logs** |
| **База даних (PostgreSQL 18)** | **Railway** (сервіс `PostgreSQL`) | Клієнти (`User`), замовлення (`Order`, `OrderDay`), баланси, тарифи, допи, системні налаштування. | Railway → Service PostgreSQL → вкладка **Data** або через Prisma Studio / DBeaver |
| **Домен і DNS** | **Cloudflare / Реєстратор** | DNS-записи (`A`, `CNAME`, `ALIAS`), SSL/TLS, захист від DDoS. | [dash.cloudflare.com](https://dash.cloudflare.com) → `foodbalance.com.ua` → **DNS** та **SSL/TLS** |
| **Telegram-бот** | **Telegram Bot API** | Авторизація без пароля через Deep-link (`/start <token>`), 6-значний OTP, адмін-сповіщення, Webhook. | [@BotFather](https://t.me/BotFather) та перевірка в браузері: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` |
| **Google Авторизація** | **Google Cloud Console** | Вхід клієнтів в 1 клік через Google акаунт (OAuth 2.0). | [console.cloud.google.com](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** |
| **Google Таблиці (CRM)** | **Google Sheets API** | Щоденний експорт замовлень для кухні та кур'єрів, архів, імпорт клієнтів. | Сервісний акаунт `foodbalance@foodbalance-506313.iam.gserviceaccount.com` |
| **Google Drive Автоматика** | **Google Drive OAuth 2.0** | Щомісячне створення нової таблиці на 20-те число місяця за шаблоном. | Адмінка сайту → `/admin/settings/sheets` |
| **Оплата (Еквайринг)** | **Monobank (Plata by Mono)** | Прийом карткових оплат (Apple Pay, Google Pay, картки), генерація адмін-посилань. | [web.monobank.ua](https://web.monobank.ua/) (Кабінет мерчанта) |
| **Медіа-сховище (S3/R2)** | **Cloudflare R2** | Фотографії страв меню, аватарки та чеки оплат. | [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage** |
| **Фонові задачі (Крони)** | **GitHub Actions** | Резервне копіювання БД, архівування замовлень, створення таблиць, черга Outbox. | GitHub репозиторій → вкладка [Actions](https://github.com/Ru1zy/foodbalancetest/actions) |

---

## 🔑 2. Повний реєстр змінних оточення (Variables Reference)

У проекті використовуються два місця зберігання секретів:
1. **Railway Variables** — змінні, необхідні для роботи веб-сайту та бекенду.
2. **GitHub Repository Secrets** — змінні, необхідні для роботи автоматичних кронів та щоденного бекапу бази даних.

### А. Змінні у Railway (Railway → Service `foodbalance` → Variables)

| Назва змінної | Призначення | Приклад значення | Що станеться, якщо відсутня або пошкоджена |
|---|---|---|---|
| `DATABASE_URL` | Підключення до PostgreSQL | `postgresql://postgres:pass@altaria.proxy.rlwy.net:44358/railway` | Додаток впаде з помилкою `502 Bad Gateway` (`Can't reach database`). |
| `APP_BASE_URL` | Головний публічний URL сайту **(БЕЗ слеша в кінці!)** | `https://foodbalance.com.ua` | Зламаються посилання на оплату Monobank, редиректи Google Auth та вебхуки. |
| `TELEGRAM_BOT_TOKEN` | Токен бота від @BotFather | `7712345678:AAH...` | Бот перестане відповідати, клієнти не зможуть увійти, адміни не отримають сповіщень. |
| `TELEGRAM_ADMIN_CHAT_ID` | Chat ID адміністраторів (через кому!) | `300333050,366707827,729923101` | Адміни втратять доступ до `/admin`, а їхні акаунти випадково можна видалити в Danger Zone. |
| `TELEGRAM_WEBHOOK_SECRET` | Захист вебхука Telegram від підробки | Випадковий безпечний рядок | Бот буде відхиляти запити з помилкою 401 (`wrong secret token`). |
| `MONOBANK_API_TOKEN` | Токен мерчанта Monobank Plata | Токен з кабінету [web.monobank.ua](https://web.monobank.ua/) | Клієнти не зможуть оплатити замовлення карткою, генератор посилань в адмінці видасть помилку. |
| `MONOBANK_TEST_MODE` | Тестовий режим оплат (`true` або `false`) | `false` | Якщо `true`, будуть створюватися несправжні тестові інвойси. |
| `PLATA_FEE_PERCENT` | Комісія еквайрингу Plata у відсотках | `1.3` | Використовується для коректного обліку сум. |
| `CRON_SECRET` | Токен авторизації кронів | Секретний рядок (ідентичний до GitHub Secrets) | Крони GitHub Actions отримають помилку `401 Unauthorized`. |
| `GOOGLE_CLIENT_ID` | Клієнтський ID для входу через Google | `...apps.googleusercontent.com` | Кнопка «Увійти через Google» видаватиме помилку. |
| `GOOGLE_CLIENT_SECRET` | Секретний ключ для Google Auth | Текстовий секрет з Google Cloud | Вхід через Google завершиться збоєм авторизації. |
| `GOOGLE_CLIENT_EMAIL` | Email сервісного акаунту для Google Sheets | `foodbalance@foodbalance-506313.iam.gserviceaccount.com` | Замовлення не синхронізуються з робочими таблицями кухні. |
| `GOOGLE_PRIVATE_KEY` | Приватний ключ сервісного акаунту | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n` | Синхронізація Google Sheets видасть `Invalid RSA Key / 403`. |
| `GOOGLE_SHEET_ID` | ID основної таблиці CRM для імпорту клієнтів | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms` | Не працюватиме імпорт клієнтів зі старої бази. |
| `GOOGLE_DRIVE_CLIENT_ID` | OAuth Client ID для створення щомісячних таблиць | `...apps.googleusercontent.com` | Автоматичне створення таблиць на новий місяць не працюватиме. |
| `GOOGLE_DRIVE_CLIENT_SECRET` | OAuth Client Secret для Google Drive | Текстовий секрет | Помилка створення таблиць Google Drive. |
| `GOOGLE_DRIVE_REDIRECT_URI` | URL колбеку авторизації Drive | `https://foodbalance.com.ua/api/admin/google-drive/callback` | Помилка `redirect_uri_mismatch` при підключенні Google Drive. |
| `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` | 32-байтний Base64 ключ шифрування токенів | Згенерований Base64 рядок (AES-256) | Неможливо розшифрувати токен доступу до Drive. |
| `S3_ENDPOINT` | URL кінцевої точки Cloudflare R2 | `https://<account_id>.r2.cloudflarestorage.com` | Завантаження фотографій страв та чеків впаде. |
| `S3_BUCKET` | Ім'я бакета Cloudflare R2 для медіа | `foodbalance-media` | Помилка завантаження медіафайлів (`NoSuchBucket`). |
| `S3_ACCESS_KEY_ID` | Access Key ID для Cloudflare R2 | Ключ R2 API Token | Помилка 403 при завантаженні картинок. |
| `S3_SECRET_ACCESS_KEY` | Secret Access Key для Cloudflare R2 | Секрет R2 API Token | Помилка 403 при завантаженні картинок. |
| `S3_PUBLIC_BASE_URL` | Публічний домен для роздачі картинок | `https://media.foodbalance.com.ua` | Фотографії страв не відображатимуться у клієнтів. |

---

### Б. Секрети у GitHub Actions (GitHub → Settings → Secrets and variables → Actions)

| Назва секрету | Призначення | Важливі вимоги | Що станеться при помилці |
|---|---|---|---|
| `DATABASE_PUBLIC_URL` | Публічний URL PostgreSQL від Railway для бекапу | Формат: `postgresql://postgres:pass@altaria.proxy.rlwy.net:44358/railway` **(БЕЗ пробілів і \n у кінці!)** | Щоденний бекап впаде: `FATAL: database "railway\n" does not exist`. |
| `CRON_SECRET` | Спільний токен для виклику кронів | **Повинен точно збігатися** зі значенням `CRON_SECRET` у Railway. | Крони завершаться з кодом `401 Unauthorized`. |
| `APP_BASE_URL` | Публічна адреса сайту для виклику кронів | `https://foodbalance.com.ua` **(БЕЗ слеша в кінці!)** | Запити підуть за неправильною адресою (`404 Not Found`). |
| `BACKUP_S3_ENDPOINT` | Endpoint S3-сховища для бекапів | Наприклад: `https://<account_id>.r2.cloudflarestorage.com` | Бекап не зможе завантажити зашифрований файл дампа. |
| `BACKUP_S3_BUCKET` | Ім'я S3 бакета для бекапів | Наприклад: `foodbalance-backups` | Помилка S3 `NoSuchBucket`. |
| `BACKUP_S3_REGION` | Регіон S3 сховища | Зазвичай `auto` (для R2) або `eu-central-1` | Помилка валідації регіону S3. |
| `BACKUP_S3_ACCESS_KEY_ID` | Ключ доступу S3 для бекапів | Рядок API ключа | Помилка 403 Access Denied при завантаженні бекапу. |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Секретний ключ S3 для бекапів | Рядок API секрету | Помилка 403 Signature Mismatch при завантаженні бекапу. |

> [!CAUTION]
> **Золоте правило копіювання секретів:**  
> При вставці секретів у поля GitHub або Railway стежте, щоб наприкінці не було випадкових пробілів або переводу рядка (`Enter`). Наші скрипти санітизують змінні, але чистий ввід гарантує 100% надійність.

---

## 🎯 3. Матриця діагностики: яку проблему де шукати і що відкривати

| Симптом / Проблема | Куди дивитися першочергово | Що відкривати | Як полагодити за 2 хвилини |
|---|---|---|---|
| **Сайт взагалі не відкривається («502 Bad Gateway» / «Application Error»)** | Логи контейнера Next.js у Railway | [railway.app](https://railway.app/) → сервіс `foodbalance` → **Deployments** → **View Logs** | Подивіться останній рядок логу. Якщо `Can't reach database` — перезапустіть сервіс PostgreSQL у Railway. Якщо помилка синтаксису змінної — перевірте останні зміни у Variables. |
| **Циклічний редирект («ERR_TOO_MANY_REDIRECTS»)** | Налаштування шифрування Cloudflare | [dash.cloudflare.com](https://dash.cloudflare.com) → `foodbalance.com.ua` → **SSL/TLS** | Перемкніть режим шифрування з **Flexible** на **Full (Strict)**. Зачекайте 1 хвилину. |
| **Крон у GitHub Actions впав («Process completed with exit code 1»)** | Логи конкретної джоби у вкладці Actions | GitHub → [Actions](https://github.com/Ru1zy/foodbalancetest/actions) → обрати останній червоний запуск | Якщо `database "railway\n" does not exist` — перевірте, чи запущено останній коміт з гілки `main`, а не старий перезапуск через «Re-run». Якщо 401 — синхронізуйте `CRON_SECRET` у GitHub та Railway. |
| **Посилання в Telegram відправляється без превью (без логотипу та опису)** | Кэш датацентрів Telegram та локальний кеш Desktop | 1. Бот [@WebpageBot](https://t.me/WebpageBot)<br>2. Чат Saved Messages | 1. Надішліть чисте посилання боту `@WebpageBot`, щоб очистити глобальний кеш.<br>2. Для негайної перевірки вставте в чат `https://foodbalance.com.ua/?1` (хвостик `?1` обходить локальний кеш клієнта). |
| **Клієнт оплатив через Monobank, але статус замовлення не став «Оплачено»** | 1. Логи запитів у Railway по ендпоінту `/api/plata/callback`<br>2. Кабінет Monobank | 1. [web.monobank.ua](https://web.monobank.ua/) → Платежі<br>2. Адмінка сайту → `/admin/orders` | 1. Перевірте в Monobank статус транзакції (успішна чи відхилена банком).<br>2. Якщо оплата пройшла, зайдіть в `/admin/orders` і натисніть кнопку **`✓ Підтвердити`** на замовленні клієнта — статус оновиться миттєво. |
| **Замовлення не потрапляють у щомісячну Google Таблицю кухні** | 1. Таблиця `OutboxJob` у базі даних<br>2. Налаштування таблиць в адмінці | Адмінка сайту → `/admin/settings/sheets` | 1. Перевірте, чи підключена таблиця для поточного місяця (наприклад, `09.2026`). Якщо ні — додайте її ID вручну або натисніть «Створити таблицю».<br>2. Перевірте, чи має сервісний акаунт `foodbalance@foodbalance-506313.iam.gserviceaccount.com` права **Редактора** на цю таблицю. |
| **Клієнт пише: «Не можу увійти, пише "Забагато спроб" або заблоковано»** | Лімітер безпеки OTP у `lib/rate-limit.ts` | База даних → таблиця `VerificationCode` | Система блокує введення коду на 15 хвилин після 5 невірних спроб (захист від підбору). Попросіть клієнта зачекати 15 хвилин або скористатися входом в 1 клік через Google / Telegram Deep-link. |
| **Помилка «redirect_uri_mismatch» при вході через Google** | Білий список адрес у Google Cloud | [console.cloud.google.com](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth Client | Додайте в **Authorized redirect URIs**: `https://foodbalance.com.ua/api/auth/google/callback`. Збережіть і зачекайте 3 хвилини. |
| **Бот у Telegram мовчить при переході за посиланням авторизації** | Статус вебхука у Telegram | Браузер: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` | Якщо в полі `last_error_message` є помилка або URL старий — зайдіть у `/admin/settings` і натисніть кнопку **«Оновити Webhook Telegram»**. |

---

## ⏰ 4. Розклад та робота автоматичних кронів

Усі крони налаштовані у файлах `.github/workflows/cron.yml` та `.github/workflows/database-backup.yml`. Вони запускаються за розкладом або вручну:

1. **`database-backup` (Щодня о 06:20 за Києвом / 03:20 UTC)**:
   - Створює повний бінарний дамп PostgreSQL 18 через `pg_dump`.
   - Розгортає тимчасову базу `foodbalance_restore_...`, відновлює туди дамп і звіряє кількість рядків у всіх 7 ключових таблицях (`User`, `Order`, `Menu`, `Tariff` тощо).
   - Шифрує дамп стійким ключем `age` (публічний ключ у `.github/backup-recipient.pub`).
   - Завантажує в Cloudflare R2 / S3 сховище з маніфестом цілісності (sha256).

2. **`archive-orders` (Щодня о 05:00 за Києвом / 02:00 UTC)**:
   - Знаходить усі замовлення, дата доставки яких минула і які оплачені/доставлені, та переводить їх у статус `archived`.
   - Переносить замовлення у вкладку «Архів» робочої Google-таблиці.
   - Видаляє кинуті неоплачені кошики клієнтів, старші за 7 днів.

3. **`check-next-month-sheet` (Щомісяця 20-го числа о 12:00 за Києвом / 09:00 UTC)**:
   - За 10–11 днів до початку наступного місяця автоматично створює нову робочу Google-таблицю доставок за шаблоном.
   - Якщо виник збій прав доступу Google Drive — негайно надсилає сповіщення з тривогою адміністраторам у Telegram.

4. **`process-outbox` (Кожні 5 хвилин)**:
   - Підхоплює всі відкладені або тимчасово збійні задачі синхронізації з Google Sheets і Telegram.
   - Якщо Google API відповів таймаутом під час замовлення на сайті, цей крон гарантовано доставить рядок у таблицю кухні.

### Як запустити будь-який крон вручну:
1. Перейдіть у репозиторій на GitHub → вкладка **Actions**.
2. У списку зліва виберіть потрібний воркфлоу (наприклад, **«Encrypted PostgreSQL backup»** або **«Scheduled cron jobs»**).
3. Праворуч натисніть кнопку **«Run workflow»**.
4. Оберіть **Branch: main** (і джобу, якщо потрібно), після чого натисніть зелену кнопку **«Run workflow»**.

---

## ⚡ 5. Шпаргалка за ключовими адмінськими функціями

### Генератор посилань на оплату Monobank (`/admin/orders`):
- Натисніть **`💳 Посилання Mono`** на будь-якому замовленні.
- Якщо у клієнта є кілька неоплачених замовлень — система автоматично запропонує **об'єднати їх в один рахунок** (bundling), покаже деталізацію та сформує єдине посилання.
- Після оплати вебхук `admin_inv_` автоматично помітить усі включені замовлення як оплачені, відправить сповіщення клієнту та оновить статус у Google Sheets.

### Модульні допи раціонів (`/admin/tariffs`):
- Модуль **«Додаткові опції раціонів (допи)»** розташований внизу сторінки тарифів.
- Дозволяє створювати загальні (для всіх раціонів) або індивідуальні допи (наприклад, Sport Active +100 ккал за 35 ₴/день).
- Можна в один клік увімкнути/вимкнути опцію 🏷️, змінити ціну ✏️ або видалити 🗑️ без перезавантаження серверів.

### Очищення тестових даних перед офіційним стартом (`/admin/settings`):
- Блок **«Danger Zone»** у самому низу налаштувань.
- **«Очистити замовлення»** — видаляє всі тестові замовлення, не чіпаючи користувачів.
- **«Очистити клієнтів (крім адмінів)»** — видаляє тестові акаунти, але **надійно захищає всіх адміністраторів**, чий Chat ID є в `TELEGRAM_ADMIN_CHAT_ID`.
- **«Імпортувати клієнтів»** — переносить клієнтську базу зі старої таблиці CRM в один клік.
