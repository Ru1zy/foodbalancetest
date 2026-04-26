import { jwtVerify, SignJWT } from "jose";
import {
  buildTelegramPlaceholderPhone,
  isTelegramPlaceholderPhone,
  TELEGRAM_PLACEHOLDER_PHONE_PREFIX,
} from "@/lib/telegram-phone";

export const AUTH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;

function getJwtSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.TELEGRAM_BOT_TOKEN;

  if (!secret) {
    throw new Error("JWT secret is not configured.");
  }

  return new TextEncoder().encode(secret);
}

export async function createAuthToken(userId: string) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());

  if (typeof payload.userId === "string" && payload.userId.length > 0) {
    return payload.userId;
  }

  if (typeof payload.sub === "string" && payload.sub.length > 0) {
    return payload.sub;
  }

  return null;
}

export {
  buildTelegramPlaceholderPhone,
  isTelegramPlaceholderPhone,
  TELEGRAM_PLACEHOLDER_PHONE_PREFIX,
};
