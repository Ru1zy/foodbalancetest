export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { AUTH_TOKEN_MAX_AGE, createAuthToken } from "@/lib/auth-token";
import { buildTelegramPlaceholderPhone, sanitizeTelegramPhone } from "@/lib/telegram-phone";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function POST(request: Request) {
  let payload: { action?: string; token?: string; chatId?: string; userName?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, token, chatId, userName } = payload;

  if (action === "generate") {
    return NextResponse.json({ token: randomUUID() }, { headers: responseHeaders });
  }

  if (action === "confirm" && token && chatId) {
    const cleanToken = String(token).trim();
    const cleanChatId = String(chatId).trim();
    try {
      await prisma.user.updateMany({ where: { chatId: cleanChatId }, data: { chatId: null } });
      await prisma.authToken.deleteMany({ where: { chatId: cleanChatId } });
      await prisma.authToken.create({
        data: {
          token: cleanToken,
          chatId: cleanChatId,
          userName: userName || "Telegram User",
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
      return NextResponse.json({ ok: true }, { headers: responseHeaders });
    } catch (error) {
      console.error("Failed to save auth token:", error);
      return NextResponse.json({ error: "Failed to save token" }, { status: 500, headers: responseHeaders });
    }
  }

  if (action === "check" && token) {
    const cleanToken = String(token).trim();
    try {
      const authData = await prisma.authToken.findUnique({ where: { token: cleanToken } });
      if (!authData) return NextResponse.json({ status: "pending" }, { headers: responseHeaders });
      if (authData.expiresAt < new Date()) {
        await prisma.authToken.delete({ where: { token: cleanToken } });
        return NextResponse.json({ status: "expired" }, { headers: responseHeaders });
      }
      const user = await prisma.user.upsert({
        where: { chatId: authData.chatId },
        update: { name: authData.userName },
        create: {
          chatId: authData.chatId,
          name: authData.userName,
          phone: buildTelegramPlaceholderPhone(authData.chatId),
        },
      });
      const sessionToken = await createAuthToken(user.id);
      const cookieStore = await cookies();
      cookieStore.set("auth_token", sessionToken, {
        httpOnly: true,
        maxAge: AUTH_TOKEN_MAX_AGE,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      await prisma.authToken.delete({ where: { token: cleanToken } });
      return NextResponse.json({
        status: "confirmed",
        user: {
          chatId: user.chatId,
          name: user.name,
          phone: sanitizeTelegramPhone(user.phone),
          userId: user.id,
        },
      }, { headers: responseHeaders });
    } catch (error) {
      console.error("Failed to check auth status:", error);
      return NextResponse.json({ status: "error" }, { status: 500, headers: responseHeaders });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400, headers: responseHeaders });
}