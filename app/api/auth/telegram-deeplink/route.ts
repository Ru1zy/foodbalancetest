import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { AUTH_TOKEN_MAX_AGE, createAuthToken } from "@/lib/auth-token";

export const runtime = "nodejs";

// In-memory store for pending auth requests (в продакшене использовать Redis)
const pendingAuths = new Map<string, { chatId: string; userName: string; timestamp: number }>();

// Cleanup old tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of pendingAuths.entries()) {
    if (now - data.timestamp > 5 * 60 * 1000) {
      pendingAuths.delete(token);
    }
  }
}, 5 * 60 * 1000);

export async function POST(request: Request) {
  const { action, token, chatId, userName } = await request.json();

  // Generate new auth token
  if (action === "generate") {
    const authToken = `auth_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return NextResponse.json({ token: authToken });
  }

  // Confirm auth (called by bot webhook)
  if (action === "confirm" && token && chatId) {
    pendingAuths.set(token, { chatId, userName: userName || "Telegram User", timestamp: Date.now() });
    return NextResponse.json({ ok: true });
  }

  // Check auth status (polling from frontend)
  if (action === "check" && token) {
    const authData = pendingAuths.get(token);

    if (!authData) {
      return NextResponse.json({ status: "pending" });
    }

    // Auth confirmed, create user and session
    try {
      const user = await prisma.user.upsert({
        where: { chatId: authData.chatId },
        update: { name: authData.userName },
        create: {
          chatId: authData.chatId,
          name: authData.userName,
          phone: `tg_${authData.chatId}`,
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

      pendingAuths.delete(token);

      return NextResponse.json({
        status: "confirmed",
        user: {
          chatId: user.chatId,
          name: user.name,
          phone: user.phone,
          userId: user.id,
        }
      });
    } catch (error) {
      console.error("Failed to create user session:", error);
      return NextResponse.json({ status: "error" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
