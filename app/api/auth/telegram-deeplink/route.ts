export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { AUTH_TOKEN_MAX_AGE, createAuthToken, verifyAuthToken } from "@/lib/auth-token";
import { buildTelegramPlaceholderPhone, sanitizeTelegramPhone } from "@/lib/telegram-phone";
import { createPublicRedirectUrl } from "@/lib/site-config";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-FoodBalance-Telegram-Auth": "2",
};

/**
 * Handle direct return links from Telegram (e.g., button in the bot).
 * Automatically sets the session cookie and redirects user to their profile/site.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const session = searchParams.get("session");
  const token = searchParams.get("token");

  // 1. Direct signed session JWT passed from bot
  if (session) {
    try {
      const userId = await verifyAuthToken(session);
      if (userId) {
        const cookieStore = await cookies();
        cookieStore.set("auth_token", session, {
          httpOnly: true,
          maxAge: AUTH_TOKEN_MAX_AGE,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
        return NextResponse.redirect(createPublicRedirectUrl("/profile", request));
      }
    } catch (error) {
      console.error("GET session verify error:", error);
    }
  }

  // 2. Deeplink token passed
  if (token) {
    try {
      const cleanToken = String(token).trim();
      const authData = await prisma.authToken.findUnique({ where: { token: cleanToken } });
      if (authData && authData.expiresAt >= new Date()) {
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
        await prisma.authToken.deleteMany({ where: { token: cleanToken } });
        return NextResponse.redirect(createPublicRedirectUrl("/profile", request));
      }
    } catch (error) {
      console.error("GET token verify error:", error);
    }
  }

  return NextResponse.redirect(createPublicRedirectUrl("/", request));
}

export async function POST(request: Request) {
  let payload: { action?: string; token?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, token } = payload;

  if (action === "generate") {
    return NextResponse.json({ token: randomUUID() }, { headers: responseHeaders });
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
      await prisma.authToken.deleteMany({ where: { token: cleanToken } });
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
