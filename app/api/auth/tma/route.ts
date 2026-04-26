import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  AUTH_TOKEN_MAX_AGE,
  buildTelegramPlaceholderPhone,
  createAuthToken,
} from "@/lib/auth-token";
import { parseCutleryCount } from "@/lib/checkout";
import { sanitizeTelegramPhone } from "@/lib/telegram-phone";

export const runtime = "nodejs";

type TelegramWebAppUser = {
  first_name?: string;
  id: number;
  username?: string;
};

function buildDataCheckString(initData: URLSearchParams) {
  return Array.from(initData.entries())
    .filter(([key]) => key !== "hash")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function isValidTelegramInitData(initData: string, botToken: string) {
  const searchParams = new URLSearchParams(initData);
  const hash = searchParams.get("hash");

  if (!hash) {
    return false;
  }

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secret)
    .update(buildDataCheckString(searchParams))
    .digest("hex");

  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(calculatedHash, "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

function parseTelegramUser(initData: string): TelegramWebAppUser | null {
  const searchParams = new URLSearchParams(initData);
  const rawUser = searchParams.get("user");

  if (!rawUser) {
    return null;
  }

  try {
    const user = JSON.parse(rawUser) as TelegramWebAppUser;

    if (!user || typeof user.id !== "number") {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return NextResponse.json({ message: "Telegram bot token is not configured.", ok: false }, { status: 500 });
  }

  let payload: { initData?: string };

  try {
    payload = (await request.json()) as { initData?: string };
  } catch {
    return NextResponse.json({ message: "Invalid request payload.", ok: false }, { status: 400 });
  }

  if (!payload.initData || typeof payload.initData !== "string") {
    return NextResponse.json({ message: "initData is required.", ok: false }, { status: 400 });
  }

  if (!isValidTelegramInitData(payload.initData, botToken)) {
    return NextResponse.json({ message: "Invalid Telegram initData.", ok: false }, { status: 401 });
  }

  const telegramUser = parseTelegramUser(payload.initData);

  if (!telegramUser) {
    return NextResponse.json({ message: "Telegram user payload is invalid.", ok: false }, { status: 400 });
  }

  const chatId = String(telegramUser.id);
  const nextName = telegramUser.first_name?.trim() || telegramUser.username?.trim() || "Telegram User";

  try {
    const user = await prisma.user.upsert({
      where: {
        chatId,
      },
      update: {
        name: nextName,
      },
      create: {
        chatId,
        name: nextName,
        phone: buildTelegramPlaceholderPhone(chatId),
      },
    });

    const token = await createAuthToken(user.id);
    const cookieStore = await cookies();

    cookieStore.set("auth_token", token, {
      httpOnly: true,
      maxAge: AUTH_TOKEN_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.json({
      ok: true,
      user: {
        address: user.address ?? "",
        chatId,
        cutlery: parseCutleryCount(user.defaultCutlery),
        name: user.name,
        notes: user.notes ?? "",
        phone: sanitizeTelegramPhone(user.phone),
        userId: user.id,
        username: telegramUser.username ?? "",
      },
    });
  } catch (error) {
    console.error("TMA auth failed", error);

    return NextResponse.json({ message: "Authentication failed.", ok: false }, { status: 500 });
  }
}
