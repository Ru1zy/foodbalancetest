import { NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import {
  AUTH_TOKEN_MAX_AGE,
  buildTelegramPlaceholderPhone,
  createAuthToken,
} from "@/lib/auth-token";

export const runtime = "nodejs";

type TelegramOAuthData = {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
};

function verifyTelegramOAuth(data: TelegramOAuthData, botToken: string): boolean {
  const { hash, ...dataWithoutHash } = data;

  const dataCheckString = Object.keys(dataWithoutHash)
    .sort()
    .map((key) => `${key}=${dataWithoutHash[key as keyof typeof dataWithoutHash]}`)
    .join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const expectedBuffer = Buffer.from(hash, "hex");
  const actualBuffer = Buffer.from(calculatedHash, "hex");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function GET(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return NextResponse.json(
      { message: "Telegram bot token is not configured.", ok: false },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);

  const oauthData: TelegramOAuthData = {
    id: searchParams.get("id") || "",
    first_name: searchParams.get("first_name") || undefined,
    last_name: searchParams.get("last_name") || undefined,
    username: searchParams.get("username") || undefined,
    photo_url: searchParams.get("photo_url") || undefined,
    auth_date: searchParams.get("auth_date") || "",
    hash: searchParams.get("hash") || "",
  };

  if (!oauthData.id || !oauthData.hash) {
    return NextResponse.redirect(new URL("/?error=invalid_oauth_data", request.url));
  }

  if (!verifyTelegramOAuth(oauthData, botToken)) {
    return NextResponse.redirect(new URL("/?error=invalid_oauth_signature", request.url));
  }

  const chatId = oauthData.id;
  const nextName =
    [oauthData.first_name, oauthData.last_name]
      .filter((v) => v && v.trim())
      .join(" ")
      .trim() || oauthData.username || "Telegram User";

  try {
    const user = await prisma.user.upsert({
      where: { chatId },
      update: { name: nextName },
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

    // Use full URL redirect to ensure cookies are set properly after OAuth
    const profileUrl = new URL("/profile", request.url);
    return NextResponse.redirect(profileUrl);
  } catch (error) {
    console.error("Telegram OAuth auth failed", error);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}
