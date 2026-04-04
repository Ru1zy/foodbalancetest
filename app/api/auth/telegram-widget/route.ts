import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  AUTH_TOKEN_MAX_AGE,
  buildTelegramPlaceholderPhone,
  createAuthToken,
  isTelegramPlaceholderPhone,
} from "@/src/lib/auth-token";
import { parseCutleryCount } from "@/src/lib/checkout";

export const runtime = "nodejs";

type TelegramWidgetPayload = {
  auth_date?: number | string;
  first_name?: string;
  hash?: string;
  id?: number | string;
  last_name?: string;
  photo_url?: string;
  username?: string;
};

function buildWidgetDataCheckString(payload: TelegramWidgetPayload) {
  return Object.entries(payload)
    .filter(([key, value]) => key !== "hash" && value !== undefined && value !== null && value !== "")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");
}

function isValidTelegramWidgetPayload(payload: TelegramWidgetPayload, botToken: string) {
  if (!payload.hash) {
    return false;
  }

  const secret = createHash("sha256").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secret)
    .update(buildWidgetDataCheckString(payload))
    .digest("hex");

  const expected = Buffer.from(String(payload.hash), "hex");
  const actual = Buffer.from(calculatedHash, "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return NextResponse.json({ message: "Telegram bot token is not configured.", ok: false }, { status: 500 });
  }

  let payload: TelegramWidgetPayload;

  try {
    payload = (await request.json()) as TelegramWidgetPayload;
  } catch {
    return NextResponse.json({ message: "Invalid request payload.", ok: false }, { status: 400 });
  }

  if (!payload.id) {
    return NextResponse.json({ message: "Telegram widget payload is invalid.", ok: false }, { status: 400 });
  }

  if (!isValidTelegramWidgetPayload(payload, botToken)) {
    return NextResponse.json({ message: "Invalid Telegram widget hash.", ok: false }, { status: 401 });
  }

  const chatId = String(payload.id);
  const nextName = [payload.first_name, payload.last_name]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .trim() || (typeof payload.username === "string" && payload.username.trim().length > 0 ? payload.username.trim() : "Telegram User");

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
        phone: isTelegramPlaceholderPhone(user.phone) ? "" : user.phone,
        userId: user.id,
        username: typeof payload.username === "string" ? payload.username : "",
      },
    });
  } catch (error) {
    console.error("Telegram widget auth failed", error);

    return NextResponse.json({ message: "Authentication failed.", ok: false }, { status: 500 });
  }
}
