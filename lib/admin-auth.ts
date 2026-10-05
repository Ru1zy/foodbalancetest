import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import prisma from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth-token";

function buildLocalDevAdmin(adminChatId: string | undefined): User {
  return {
    id: "local-dev-admin",
    phone: "local-dev-admin",
    name: "Local Admin",
    chatId: adminChatId ?? "local-dev-admin",
    email: null,
    googleId: null,
    avatarUrl: null,
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

  const adminIds = adminChatId.split(",").map((id) => id.trim());

  // LOCAL DEV BYPASS:
  // Requires both NODE_ENV === "development" and explicit ENABLE_LOCAL_DEV_ADMIN === "true".
  // Never enable this in production or staging.
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ENABLE_LOCAL_DEV_ADMIN === "true"
  ) {
    return buildLocalDevAdmin(adminIds[0]);
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

  if (!user || !adminIds.includes(String(user.chatId))) {
    return null;
  }

  return user;
}
