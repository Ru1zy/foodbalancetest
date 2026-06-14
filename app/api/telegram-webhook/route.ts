import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { id: number; first_name?: string; last_name?: string; username?: string };
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; last_name?: string; username?: string };
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };
};

async function sendTelegramRequest(method: string, body: Record<string, unknown>) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

export async function POST(request: Request) {
  try {
    // Authenticate the webhook: Telegram echoes the secret configured via
    // setWebhook(secret_token=...) in this header. Reject anything that doesn't
    // match so nobody who merely knows the URL can forge confirm_<token> events
    // or spam the GAS proxy.
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const headerToken = request.headers.get("x-telegram-bot-api-secret-token");
      if (headerToken !== webhookSecret) {
        console.warn("Telegram webhook rejected: invalid secret token");
        return NextResponse.json({ ok: false }, { status: 401 });
      }
    } else {
      console.warn(
        "TELEGRAM_WEBHOOK_SECRET is not set — webhook is UNAUTHENTICATED. " +
          "Set it and re-register the webhook with the same secret_token.",
      );
    }

    const update: TelegramUpdate = await request.json();
    console.log("Webhook received:", JSON.stringify(update, null, 2));

    // Handle /start command with auth token
    if (update.message?.text?.startsWith("/start auth_")) {
      const token = update.message.text.replace("/start ", "").trim();
      const chatId = update.message.chat.id;

      await sendTelegramRequest("sendMessage", {
        chat_id: chatId,
        text: "🔐 Підтвердіть вхід на сайт FoodBalance\n\nНатисніть кнопку нижче для авторизації.",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Підтвердити вхід", callback_data: `confirm_${token}` }
          ]]
        }
      });

      return NextResponse.json({ ok: true });
    }

    // Handle callback button press
    if (update.callback_query?.data?.startsWith("confirm_")) {
      console.log("Callback query received:", update.callback_query.data);
      const token = update.callback_query.data.replace("confirm_", "").trim();
      const chatId = String(update.callback_query.from.id);
      const firstName = (update.callback_query.from.first_name || "").trim();
      const lastName = (update.callback_query.from.last_name || "").trim();
      const userName = [firstName, lastName].filter(Boolean).join(" ") || 
                       (update.callback_query.from.username || "").trim() || 
                       "Telegram User";

      console.log("Confirming auth via endpoint:", { token, chatId, userName });

      // Notify our auth endpoint to handle user creation/session
      try {
        await fetch(`${new URL(request.url).origin}/api/auth/telegram-deeplink`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm",
            token,
            chatId,
            userName
          })
        });
        console.log("Auth endpoint notified");
      } catch (error) {
        console.error("Failed to notify auth endpoint:", error);
      }

      // Answer callback query
      await sendTelegramRequest("answerCallbackQuery", {
        callback_query_id: update.callback_query.id,
        text: "✅ Вхід підтверджено!"
      });

      // Edit message
      if (update.callback_query.message) {
        await sendTelegramRequest("editMessageText", {
          chat_id: update.callback_query.message.chat.id,
          message_id: update.callback_query.message.message_id,
          text: "✅ Ви успішно авторизувалися на сайті FoodBalance!"
        });
      }

      return NextResponse.json({ ok: true });
    }

    // --- ПРОКСИ ДЛЯ GAS ---
    // Если это не логин, пересылаем весь запрос в старый GAS скрипт
    const GAS_WEBAPP_URL = process.env.GAS_WEBAPP_URL;
    
    if (GAS_WEBAPP_URL) {
      try {
        await fetch(GAS_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update) // Отправляем оригинальный payload
        });
        console.log("Успешно переслано в GAS");
      } catch (err) {
        console.error("Ошибка пересылки в GAS:", err);
      }
    } else {
      console.error("Не задан GAS_WEBAPP_URL в переменных окружения!");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}