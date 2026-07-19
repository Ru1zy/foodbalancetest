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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const headerToken = request.headers.get("x-telegram-bot-api-secret-token");
      if (headerToken !== webhookSecret) {
        console.warn("Telegram webhook rejected: invalid secret token");
        return NextResponse.json({ ok: false }, { status: 401 });
      }
    }

    const update: TelegramUpdate = await request.json();
    console.log("Webhook received:", JSON.stringify(update, null, 2));

    // Handle /start <uuid> — auth deep link from the site
    const startText = update.message?.text ?? "";
    if (startText.startsWith("/start ")) {
      const token = startText.slice(7).trim();
      if (UUID_RE.test(token)) {
        const chatId = update.message!.chat.id;

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
    }

    // Handle confirm button press
    if (update.callback_query?.data?.startsWith("confirm_")) {
      const token = update.callback_query.data.slice(8).trim();
      const chatId = String(update.callback_query.from.id);
      const firstName = (update.callback_query.from.first_name || "").trim();
      const lastName = (update.callback_query.from.last_name || "").trim();
      const userName = [firstName, lastName].filter(Boolean).join(" ") ||
                       (update.callback_query.from.username || "").trim() ||
                       "Telegram User";

      try {
        await fetch(`${new URL(request.url).origin}/api/auth/telegram-deeplink`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm", token, chatId, userName }),
        });
      } catch (error) {
        console.error("Failed to notify auth endpoint:", error);
      }

      await sendTelegramRequest("answerCallbackQuery", {
        callback_query_id: update.callback_query.id,
        text: "✅ Вхід підтверджено!",
      });

      if (update.callback_query.message) {
        await sendTelegramRequest("editMessageText", {
          chat_id: update.callback_query.message.chat.id,
          message_id: update.callback_query.message.message_id,
          text: "✅ Ви успішно авторизувалися на сайті FoodBalance!",
        });
      }

      return NextResponse.json({ ok: true });
    }

    // Proxy everything else to GAS
    const GAS_WEBAPP_URL = process.env.GAS_WEBAPP_URL;
    if (GAS_WEBAPP_URL) {
      try {
        await fetch(GAS_WEBAPP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update),
        });
      } catch (err) {
        console.error("Ошибка пересылки в GAS:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
