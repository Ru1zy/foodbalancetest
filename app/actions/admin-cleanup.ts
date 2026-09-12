"use server";

import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { getPublicAppUrl } from "@/lib/site-config";

export type CleanupResult = {
  ok: boolean;
  error?: string;
  deletedOrders?: number;
  deletedPurchases?: number;
  deletedUsers?: number;
  preservedAdmins?: string[];
  message?: string;
};

/**
 * Deletes all test orders, order days, subscription purchases,
 * and idempotency keys from the database.
 * Does NOT touch client accounts.
 */
export async function clearOrdersAction(): Promise<CleanupResult> {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Доступ заборонено: потрібні права адміністратора" };
  }

  try {
    const [ordersCount, purchasesCount] = await prisma.$transaction(async (tx) => {
      // OrderDay has onDelete: Cascade from Order, so deleting Order deletes OrderDay
      const orders = await tx.order.deleteMany({});
      const purchases = await tx.subscriptionPurchase.deleteMany({});
      await tx.checkoutIdempotency.deleteMany({});
      await tx.outboxJob.deleteMany({});

      // Reset balance usedDays back to 0 for remaining users
      await tx.userBalance.updateMany({
        data: { usedDays: 0 },
      });

      return [orders.count, purchases.count];
    });

    return {
      ok: true,
      deletedOrders: ordersCount,
      deletedPurchases: purchasesCount,
      message: `Видалено ${ordersCount} замовлень та ${purchasesCount} покупок підписок.`,
    };
  } catch (error) {
    console.error("clearOrdersAction failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Помилка при очищенні замовлень",
    };
  }
}

/**
 * Deletes all non-admin users from the database.
 * Users whose chatId is listed in TELEGRAM_ADMIN_CHAT_ID are strictly preserved.
 */
export async function clearNonAdminClientsAction(): Promise<CleanupResult> {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Доступ заборонено: потрібні права адміністратора" };
  }

  const adminChatIdEnv = process.env.TELEGRAM_ADMIN_CHAT_ID || "";
  const adminIds = adminChatIdEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (adminIds.length === 0) {
    return {
      ok: false,
      error: "Змінна TELEGRAM_ADMIN_CHAT_ID порожня або не налаштована. Очищення заблоковано для безпеки адмінів.",
    };
  }

  try {
    // 1. Find all admin users in DB
    const adminUsers = await prisma.user.findMany({
      where: {
        chatId: { in: adminIds },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        chatId: true,
      },
    });

    const adminUserIds = adminUsers.map((u) => u.id);

    // 2. Delete all other users (cascade deletes their balances, purchases, reviews, etc.)
    const deleteResult = await prisma.user.deleteMany({
      where: {
        id: { notIn: adminUserIds },
      },
    });

    // Also clean up support tickets left behind
    await prisma.supportTicket.deleteMany({});

    return {
      ok: true,
      deletedUsers: deleteResult.count,
      preservedAdmins: adminUsers.map((a) => `${a.name} (Chat ID: ${a.chatId})`),
      message: `Видалено ${deleteResult.count} тестових клієнтів. Збережено адмінів: ${adminUsers.length}.`,
    };
  } catch (error) {
    console.error("clearNonAdminClientsAction failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Помилка при очищенні клієнтів",
    };
  }
}

/**
 * Full cleanup: removes all test orders, purchases, and all non-admin users.
 * Keeps admin accounts safe.
 */
export async function clearAllTestDataAction(): Promise<CleanupResult> {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Доступ заборонено: потрібні права адміністратора" };
  }

  const ordersRes = await clearOrdersAction();
  if (!ordersRes.ok) return ordersRes;

  const clientsRes = await clearNonAdminClientsAction();
  if (!clientsRes.ok) return clientsRes;

  return {
    ok: true,
    deletedOrders: ordersRes.deletedOrders,
    deletedPurchases: ordersRes.deletedPurchases,
    deletedUsers: clientsRes.deletedUsers,
    preservedAdmins: clientsRes.preservedAdmins,
    message: `Повне очищення виконано! Видалено ${ordersRes.deletedOrders} замовлень, ${ordersRes.deletedPurchases} покупок та ${clientsRes.deletedUsers} клієнтів. Адміни збережені.`,
  };
}

/**
 * Registers or updates the Telegram Bot Webhook to the current domain.
 */
export async function updateTelegramWebhookAction(): Promise<{ ok: boolean; message: string }> {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, message: "Доступ заборонено" };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token) {
    return { ok: false, message: "TELEGRAM_BOT_TOKEN не задано в змінних середовища" };
  }

  const appUrl = getPublicAppUrl();
  const webhookUrl = `${appUrl}/api/telegram-webhook`;

  try {
    const params = new URLSearchParams({
      url: webhookUrl,
    });
    if (secret) {
      params.append("secret_token", secret);
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?${params.toString()}`);
    const data = await response.json();

    if (data.ok) {
      return {
        ok: true,
        message: `Webhook Telegram успішно зареєстровано на: ${webhookUrl}`,
      };
    } else {
      return {
        ok: false,
        message: `Telegram API повернув помилку: ${data.description || JSON.stringify(data)}`,
      };
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Помилка виклику Telegram API",
    };
  }
}
