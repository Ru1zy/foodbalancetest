import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { AUTH_TOKEN_MAX_AGE, createAuthToken } from "@/lib/auth-token";
import { buildTelegramPlaceholderPhone, sanitizeTelegramPhone } from "@/lib/telegram-phone";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { action, token, chatId, userName } = await request.json();

  // Generate new auth token
  if (action === "generate") {
    const authToken = `auth_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return NextResponse.json({ token: authToken });
  }

  // Confirm auth (called by bot webhook)
  if (action === "confirm" && token && chatId) {
    try {
      await prisma.authToken.create({
        data: {
          token,
          chatId,
          userName: userName || "Telegram User",
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        },
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("Failed to save auth token:", error);
      return NextResponse.json({ error: "Failed to save token" }, { status: 500 });
    }
  }

  // Check auth status (polling from frontend)
  if (action === "check" && token) {
    try {
      const authData = await prisma.authToken.findUnique({
        where: { token },
      });

      if (!authData) {
        return NextResponse.json({ status: "pending" });
      }

      // Check if expired
      if (authData.expiresAt < new Date()) {
        await prisma.authToken.delete({ where: { token } });
        return NextResponse.json({ status: "expired" });
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
      await prisma.authToken.delete({ where: { token } });

      return NextResponse.json({
        status: "confirmed",
        user: {
          chatId: user.chatId,
          name: user.name,
          phone: sanitizeTelegramPhone(user.phone),
          userId: user.id,
        }
      });
    } catch (error) {
      console.error("Failed to check auth status:", error);
      return NextResponse.json({ status: "error" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
