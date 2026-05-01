export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { AUTH_TOKEN_MAX_AGE, createAuthToken } from "@/lib/auth-token";
import { buildTelegramPlaceholderPhone, sanitizeTelegramPhone } from "@/lib/telegram-phone";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, token, chatId, userName } = payload;

  const responseHeaders = {
    "Cache-Control": "no-store, max-age=0, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  };

  // Generate new auth token
  if (action === "generate") {
    const authToken = `auth_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return NextResponse.json({ token: authToken }, { headers: responseHeaders });
  }

  // Confirm auth (called by bot webhook)
  if (action === "confirm" && token && chatId) {
    const nextToken = String(token).trim();
    try {
      await prisma.authToken.create({
        data: {
          token: nextToken,
          chatId: String(chatId),
          userName: userName || "Telegram User",
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        },
      });
      return NextResponse.json({ ok: true }, { headers: responseHeaders });
    } catch (error) {
      console.error("Failed to save auth token:", error);
      return NextResponse.json({ error: "Failed to save token" }, { status: 500, headers: responseHeaders });
    }
  }

  // Check auth status (polling from frontend)
  if (action === "check" && token) {
    const nextToken = String(token).trim();
    try {
      const authData = await prisma.authToken.findUnique({
        where: { token: nextToken },
      });

      if (!authData) {
        return NextResponse.json({ status: "pending" }, { headers: responseHeaders });
      }

      // Check if expired
      if (authData.expiresAt < new Date()) {
        await prisma.authToken.delete({ where: { token: nextToken } });
        return NextResponse.json({ status: "expired" }, { headers: responseHeaders });
      }

      // Auth confirmed, create user and session
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

      // Delete used token
      await prisma.authToken.delete({ where: { token: nextToken } });

      return NextResponse.json({
        status: "confirmed",
        user: {
          chatId: user.chatId,
          name: user.name,
          phone: sanitizeTelegramPhone(user.phone),
          userId: user.id,
        }
      }, { headers: responseHeaders });
    } catch (error) {
      console.error("Failed to check auth status:", error);
      return NextResponse.json({ status: "error" }, { status: 500, headers: responseHeaders });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400, headers: responseHeaders });
}
