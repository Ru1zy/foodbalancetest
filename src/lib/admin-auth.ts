import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import prisma from "@/lib/prisma";
import { verifyAuthToken } from "@/src/lib/auth-token";

function buildLocalDevAdmin(adminChatId: string | undefined): User {
  return {
    id: "local-dev-admin",
    phone: "local-dev-admin",
    name: "Local Admin",
    chatId: adminChatId ?? "local-dev-admin",
    address: "Localhost admin bypass",
    defaultPackage: null,
    defaultCutlery: null,
    notes: null,
  };
}

export async function getAuthenticatedAdminUser() {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!adminChatId) {
    console.error("TELEGRAM_ADMIN_CHAT_ID is not configured.");
    return null;
  }

  // TEMP LOCALHOST BYPASS:
  // Leave this block enabled only while you are testing `/admin` on localhost
  // without Telegram auth. For the regular production behavior, comment this
  // block back out so the original token verification below is used again.
  if (process.env.NODE_ENV === "development") {
    return buildLocalDevAdmin(adminChatId);
  }

  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth_token")?.value;

  if (!authToken) {
    return null;
  }

  let userId: string | null = null;

  try {
    userId = await verifyAuthToken(authToken);
  } catch (error) {
    console.error("Admin auth token verification failed", error);
    return null;
  }

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user || user.chatId !== adminChatId) {
    return null;
  }

  return user;
}
