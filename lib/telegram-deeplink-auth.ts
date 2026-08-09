import "server-only";

import prisma from "@/lib/prisma";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TELEGRAM_USER_ID_RE = /^\d{1,20}$/;

type TelegramAuthConfirmation = {
  token: string;
  chatId: string;
  userName: string;
};

export async function recordTelegramAuthConfirmation({
  token,
  chatId,
  userName,
}: TelegramAuthConfirmation) {
  const cleanToken = token.trim();
  const cleanChatId = chatId.trim();
  const cleanUserName = userName.trim().slice(0, 255) || "Telegram User";

  if (!UUID_RE.test(cleanToken) || !TELEGRAM_USER_ID_RE.test(cleanChatId)) {
    throw new Error("Invalid Telegram authentication confirmation");
  }

  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { chatId: cleanChatId } }),
    prisma.authToken.create({
      data: {
        token: cleanToken,
        chatId: cleanChatId,
        userName: cleanUserName,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    }),
  ]);
}
