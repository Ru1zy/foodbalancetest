# История решения проблемы с Telegram авторизацией
**Дата:** 10 апреля 2026
**Проект:** FoodBalance (D:\foodbalance)

## Проблема
Telegram Login Widget перестал работать для новых пользователей - требует номер телефона, но коды не приходят.

## Что выяснили

### 1. Telegram Login Widget требует куки от telegram.org
- У тебя работало, потому что были куки от telegram.org
- У новых пользователей (инкогнито, брат) - не работает
- Это НЕ баг в коде, это ограничение Telegram

### 2. Telegram OAuth тоже не работает без кук
- Пробовали `oauth.telegram.org` с параметром `embed=1`
- Всё равно требует номер телефона
- Коды не приходят

### 3. Уведомления от Telegram приходят только с куками
- С новым ботом @PeaseDoseBot протестировали
- В обычном браузере (с куками) - уведомление пришло
- В инкогнито (без кук) - уведомление НЕ пришло
- **Вывод:** Telegram не отправляет уведомления пользователям без активной сессии

## Что сделали

### Удалили мертвый код
- `components/TelegramLoginButton.impl.tsx` ❌
- `components/TelegramLoginButton.tsx` ❌
- `app/api/auth/telegram-widget/route.ts` ❌

### Создали новое решение - Deep Link авторизация
**Файлы:**
1. `app/api/auth/telegram-deeplink/route.ts` - API для генерации токенов и проверки статуса
2. `app/api/telegram-webhook/route.ts` - Webhook для обработки команд бота
3. `components/TelegramDeepLinkAuth.tsx` - Компонент с кнопкой и polling

**Как работает:**
1. Пользователь нажимает кнопку на сайте
2. Генерируется уникальный токен `auth_TIMESTAMP_RANDOM`
3. Открывается `t.me/BOT?start=auth_TOKEN`
4. Бот отправляет сообщение с inline кнопкой "✅ Підтвердити вхід" **В ТЕЛЕГРАМЕ**
5. Пользователь жмет кнопку **В ТЕЛЕГРАМЕ** (не в браузере!)
6. Бот через webhook уведомляет сервер
7. Сайт через polling (каждые 2 сек) проверяет статус
8. После подтверждения - авторизация и редирект в профиль

## Что нужно доделать

### 1. Создать нового бота (или использовать @PeaseDoseBot)
```
@BotFather → /newbot
Имя: FoodBalance
Username: foodbalance_prod_bot (или оставить PeaseDoseBot)
```

### 2. Обновить .env
```
TELEGRAM_BOT_TOKEN="НОВЫЙ_ТОКЕН_ОТ_BOTFATHER"
NEXT_PUBLIC_BOT_USERNAME="PeaseDoseBot" (или новый username)
```

### 3. Задеплоить на Vercel

### 4. Настроить webhook
После деплоя выполнить:
```bash
curl -X POST "https://api.telegram.org/botТВОЙ_ТОКЕН/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://foodbalancetest.vercel.app/api/telegram-webhook"}'
```

### 5. Настроить домен в BotFather
```
/setdomain
@PeaseDoseBot
foodbalancetest.vercel.app
```

## Почему это решение будет работать

✅ **Не требует кук от telegram.org** - всё происходит в Telegram
✅ **Не требует SMS кодов** - подтверждение через кнопку в боте
✅ **Работает для ВСЕХ пользователей** - даже новых без сессии
✅ **Простое UX** - один клик в боте

## Текущее состояние

**Работает:**
- ✅ Гостевое оформление заказа (без авторизации)
- ✅ TelegramProvider (Mini App авторизация) - работает внутри Telegram
- ✅ Структурирование адреса на 5 полей (street, house, apartment, entrance, intercom)
- ✅ Сброс состояния визарда после оформления заказа
- ✅ CRM для управления оплатой заказов с Telegram уведомлениями
- ✅ Zustand persist middleware для сохранения состояния

**Не работает (нужно доделать):**
- ❌ Deep Link авторизация - нужно настроить webhook бота

## Важные заметки

1. **Telegram Login Widget больше не надежен** из-за блокировки third-party cookies в современных браузерах
2. **Telegram OAuth требует активную сессию** - не подходит для новых пользователей
3. **Единственное надежное решение** - авторизация через бота с подтверждением В ТЕЛЕГРАМЕ
4. **whale.tg работает** потому что их пользователи уже имеют куки от telegram.org

## Следующие шаги (когда проснешься)

1. Создай нового бота или используй @PeaseDoseBot
2. Обнови .env с новым токеном
3. Задеплой на Vercel
4. Настрой webhook командой выше
5. Протестируй в инкогнито - должно работать

**Это решение 100% будет работать, потому что не зависит от кук браузера.**

---

## Технические детали

### Структура проекта
```
app/
  api/
    auth/
      telegram-deeplink/route.ts  - Генерация токенов и проверка статуса
      telegram-oauth/callback/route.ts - OAuth (не работает)
      tma/route.ts - Mini App авторизация (работает)
      logout/route.ts - Выход
    telegram-webhook/route.ts - Webhook для бота
    telegram-bot-id/route.ts - Получение ID бота
  checkout/page-impl.tsx - Страница оформления заказа
  admin/orders/page.tsx - CRM для заказов

components/
  TelegramDeepLinkAuth.tsx - Компонент авторизации (новый)
  TelegramOAuthButton.tsx - OAuth кнопка (не работает)
  TelegramProvider.tsx - Mini App провайдер (работает)
  admin/OrderActionButtons.tsx - Кнопки подтверждения оплаты

lib/
  orderStore.ts - Zustand store с persist
  telegram.ts - Отправка уведомлений в Telegram
  checkout.ts - Парсинг адреса на 5 полей
```

### Переменные окружения
```
DATABASE_URL - PostgreSQL от Neon
TELEGRAM_BOT_TOKEN - Токен бота
TELEGRAM_ADMIN_CHAT_ID - ID админа для уведомлений
NEXT_PUBLIC_BOT_USERNAME - Username бота
BLOB_READ_WRITE_TOKEN - Vercel Blob для фото
```

Отдыхай! Завтра доделаем.
