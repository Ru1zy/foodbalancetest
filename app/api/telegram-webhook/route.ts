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

async function sendTelegramRequest(method: string, body: any) {
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
    const update: TelegramUpdate = await request.json();

    // Handle /start command with auth token
    if (update.message?.text?.startsWith("/start auth_")) {
      const token = update.message.text.replace("/start auth_", "").trim();
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
      const token = update.callback_query.data.replace("confirm_", "");
      const chatId = String(update.callback_query.from.id);
      const userName = [
        update.callback_query.from.first_name,
        update.callback_query.from.last_name
      ].filter(Boolean).join(" ") || update.callback_query.from.username || "Telegram User";

      // Notify our auth endpoint
      const confirmResponse = await fetch(`${new URL(request.url).origin}/api/auth/telegram-deeplink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          token,
          chatId,
          userName
        })
      });

      if (!confirmResponse.ok) {
        console.error("Failed to confirm auth:", await confirmResponse.text());
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
