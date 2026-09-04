import { NextResponse } from "next/server";
import { recordTelegramAuthConfirmation } from "@/lib/telegram-deeplink-auth";
import prisma from "@/lib/prisma";
import { createAuthToken, buildTelegramPlaceholderPhone } from "@/lib/auth-token";
import { SITE_CONFIG, getPublicAppUrl } from "@/lib/site-config";

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
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    const headerToken = request.headers.get("x-telegram-bot-api-secret-token");

    if (!webhookSecret) {
      console.error("Telegram webhook rejected: TELEGRAM_WEBHOOK_SECRET is missing");
      return NextResponse.json({ ok: false }, { status: 503 });
    }

    if (headerToken !== webhookSecret) {
      console.warn("Telegram webhook rejected: invalid secret token");
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const update: TelegramUpdate = await request.json();

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
        await recordTelegramAuthConfirmation({ token, chatId, userName });
      } catch (error) {
        console.error("Failed to confirm Telegram authentication:", error);
        await sendTelegramRequest("answerCallbackQuery", {
          callback_query_id: update.callback_query.id,
          text: "Не вдалося підтвердити вхід. Спробуйте ще раз.",
          show_alert: true,
        });
        return NextResponse.json({ ok: false }, { status: 500 });
      }

      await sendTelegramRequest("answerCallbackQuery", {
        callback_query_id: update.callback_query.id,
        text: "✅ Вхід підтверджено!",
      });

      const baseUrl = getPublicAppUrl(request);

      let returnUrl = baseUrl;
      try {
        const user = await prisma.user.upsert({
          where: { chatId },
          update: { name: userName },
          create: {
            chatId,
            name: userName,
            phone: buildTelegramPlaceholderPhone(chatId),
          },
        });
        const sessionToken = await createAuthToken(user.id);
        returnUrl = `${baseUrl}/api/auth/telegram-deeplink?session=${encodeURIComponent(sessionToken)}`;
      } catch (userErr) {
        console.error("Failed to generate direct session link for telegram return:", userErr);
      }

      if (update.callback_query.message) {
        await sendTelegramRequest("editMessageText", {
          chat_id: update.callback_query.message.chat.id,
          message_id: update.callback_query.message.message_id,
          text: "✅ Ви успішно авторизувалися на сайті FoodBalance!\n\nТепер ви можете повернутися на сайт і продовжити оформлення замовлення.",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🌐 Перейти на сайт FoodBalance",
                  url: returnUrl,
                },
              ],
            ],
          },
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
