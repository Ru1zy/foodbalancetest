"use server";

import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { enqueueOutboxJob, processAllOutboxJobs } from "@/lib/outbox";

export async function confirmPaymentAction(purchaseId: string) {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Unauthorized" };
  }
  const adminName = admin.name || "Admin";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.subscriptionPurchase.update({
        where: { id: purchaseId },
        data: {
          status: "PAID",
          confirmedBy: adminName,
          confirmedAt: new Date(),
        },
      });

      await enqueueOutboxJob(tx, "TELEGRAM_NOTIFICATION_SUBSCRIPTION_RESULT", { purchaseId, approved: true });
    });

    revalidatePath("/admin/pending-payments");
    revalidatePath("/profile");
    
    processAllOutboxJobs().catch(err => console.error("Async outbox error:", err));

    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to confirm payment:", error);
    return { ok: false, error: "Помилка при підтвердженні оплати" };
  }
}

export async function rejectPaymentAction(purchaseId: string) {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Unauthorized" };
  }
  const adminName = admin.name || "Admin";

  try {
    const purchase = await prisma.subscriptionPurchase.findUnique({
      where: { id: purchaseId }
    });

    if (!purchase) {
      return { ok: false, error: "Покупка не знайдена" };
    }

    if (purchase.status === "PAID") {
      return { ok: false, error: "Оплата вже підтверджена" };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Змінюємо статус на CANCELLED
      await tx.subscriptionPurchase.update({
        where: { id: purchaseId },
        data: {
          status: "CANCELLED",
          confirmedBy: adminName,
          confirmedAt: new Date(),
        },
      });

      // 2. Знімаємо дні з балансу, які були нараховані авансом
      await tx.userBalance.updateMany({
        where: {
          userId: purchase.userId,
          packageId: purchase.packageId,
        },
        data: {
          totalDays: { decrement: purchase.days },
        },
      });

      // 3. Notify user
      await enqueueOutboxJob(tx, "TELEGRAM_NOTIFICATION_SUBSCRIPTION_RESULT", { purchaseId, approved: false });
    });

    revalidatePath("/admin/pending-payments");
    revalidatePath("/profile");
    
    processAllOutboxJobs().catch(err => console.error("Async outbox error:", err));

    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to reject payment:", error);
    return { ok: false, error: "Помилка при скасуванні оплати" };
  }
}

export async function confirmOrderPaymentAction(orderId: string) {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        isPaid: true,
        status: "Оплачено",
      },
      include: {
        user: true,
      },
    });

    if (order.user && (order.user.chatId || order.user.email)) {
      try {
        const { sendPaymentConfirmation } = await import("@/lib/telegram");
        await sendPaymentConfirmation(order.user, {
          date: order.deliveryDate,
          pkg: order.packageType,
          sendEmailReceipt: order.sendEmailReceipt,
          receiptEmail: order.receiptEmail,
        });
      } catch (err) {
        console.error("Failed to send payment confirmation notification:", err);
      }
    }

    revalidatePath("/admin/pending-payments");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/today");

    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to confirm order payment:", error);
    return { ok: false, error: "Помилка при підтвердженні оплати замовлення" };
  }
}

export async function rejectOrderPaymentAction(orderId: string) {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "Скасовано",
      },
    });

    revalidatePath("/admin/pending-payments");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/today");

    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to reject order payment:", error);
    return { ok: false, error: "Помилка при відхиленні замовлення" };
  }
}

export async function resolveRefundWithBalanceAction(orderId: string, daysToCredit: number = 1) {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Unauthorized" };
  }
  const adminName = admin.name || "Admin";

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { days: true, user: true },
    });

    if (!order) {
      return { ok: false, error: "Замовлення не знайдено" };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Credit days to userBalance
      await tx.userBalance.upsert({
        where: {
          userId_packageId: {
            userId: order.userId,
            packageId: order.packageType,
          },
        },
        create: {
          userId: order.userId,
          packageId: order.packageType,
          totalDays: daysToCredit,
          usedDays: 0,
        },
        update: {
          totalDays: { increment: daysToCredit },
        },
      });

      // 2. Mark cancelled OrderDay records as resolved
      await tx.orderDay.updateMany({
        where: {
          orderId: order.id,
          status: "cancelled",
        },
        data: {
          cancelReason: `[RESOLVED: BALANCE_CREDITED by ${adminName} at ${new Date().toISOString()}]`,
        },
      });

      // 3. Mark Order as resolved in notes
      const currentNotes = order.notes || "";
      await tx.order.update({
        where: { id: order.id },
        data: {
          notes: `${currentNotes} [RESOLVED: +${daysToCredit}d credited by ${adminName}]`.trim(),
        },
      });
    });

    if (order.user?.chatId) {
      try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token) {
          const text = `✅ <b>Компенсація за скасовану доставку</b>\n\nВам нараховано <b>+${daysToCredit} дн.</b> тарифу <b>${order.packageType}</b> на баланс абонемента!\nТепер ви можете обрати будь-яку іншу дату в особистому кабінеті без повторної оплати.`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: order.user.chatId, text, parse_mode: "HTML" }),
          });
        }
      } catch (err) {
        console.error("Failed to notify user about balance refund:", err);
      }
    }

    revalidatePath("/admin/pending-payments");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/clients");
    revalidatePath("/profile");

    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to resolve refund with balance:", error);
    return { ok: false, error: "Помилка при нарахуванні днів на баланс" };
  }
}

export async function resolveRefundWithPayoutAction(orderId: string) {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Unauthorized" };
  }
  const adminName = admin.name || "Admin";

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { days: true, user: true },
    });

    if (!order) {
      return { ok: false, error: "Замовлення не знайдено" };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Mark cancelled OrderDay records as resolved
      await tx.orderDay.updateMany({
        where: {
          orderId: order.id,
          status: "cancelled",
        },
        data: {
          cancelReason: `[RESOLVED: REFUNDED_MANUALLY by ${adminName} at ${new Date().toISOString()}]`,
        },
      });

      // 2. Mark Order as resolved in notes
      const currentNotes = order.notes || "";
      await tx.order.update({
        where: { id: order.id },
        data: {
          notes: `${currentNotes} [RESOLVED: Refunded manually by ${adminName}]`.trim(),
        },
      });
    });

    if (order.user?.chatId) {
      try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token) {
          const text = `💸 <b>Повернення коштів</b>\n\nКошти за скасовану доставку тарифу <b>${order.packageType}</b> успішно повернено за вашими реквізитами. Дякуємо!`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: order.user.chatId, text, parse_mode: "HTML" }),
          });
        }
      } catch (err) {
        console.error("Failed to notify user about payout refund:", err);
      }
    }

    revalidatePath("/admin/pending-payments");
    revalidatePath("/admin/orders");

    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to resolve refund with payout:", error);
    return { ok: false, error: "Помилка при збереженні статусу повернення" };
  }
}

