import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
      const token = update.callback_query.data.replace("confirm_", "");
      const chatId = String(update.callback_query.from.id);
      const userName = [
        update.callback_query.from.first_name,
        update.callback_query.from.last_name
      ].filter(Boolean).join(" ") || update.callback_query.from.username || "Telegram User";

      console.log("Confirming auth:", { token, chatId, userName });

      // Save directly to database instead of calling API
      try {
        await prisma.authToken.create({
          data: {
            token,
            chatId,
            userName,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          },
        });
        console.log("Auth token saved to database");
      } catch (error) {
        console.error("Failed to save auth token:", error);
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
