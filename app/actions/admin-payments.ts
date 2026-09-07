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

export async function rejectPaymentAction(purchaseId: string, moneyReceived: boolean = false) {
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
          confirmedBy: moneyReceived
            ? `[NEED_REFUND: Rejected by ${adminName} after payment received]`
            : `[RESOLVED: REJECTED_NO_PAYMENT by ${adminName}]`,
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

      if (moneyReceived) {
        await enqueueOutboxJob(tx, "TELEGRAM_ALERT_SUBSCRIPTION_CANCELLATION", {
          purchaseId: purchase.id,
          cancelledBy: `Адміністратор (${adminName}) [ВІДХИЛЕНО ПІСЛЯ ОПЛАТИ]`,
        });
      }
    });

    revalidatePath("/admin/pending-payments");
    revalidatePath("/profile");
    
    processAllOutboxJobs().catch(err => console.error("Async outbox error:", err));

    return { ok: true, moneyReceived };
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

export async function rejectOrderPaymentAction(orderId: string, moneyReceived: boolean = false) {
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

    if (!moneyReceived) {
      // Regular rejection: client didn't pay (fake receipt or no transfer)
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "Скасовано",
          },
        });

        await tx.orderDay.updateMany({
          where: { orderId: order.id },
          data: {
            status: "cancelled",
            cancelledAt: new Date(),
            cancelReason: `Rejected by ${adminName}: No payment received`,
          },
        });
      });
    } else {
      // Money WAS received! Client paid via IBAN/money, but admin refused/cancelled the order.
      // Mark as paid & cancelled so it automatically lands in the "До повернення (Refunds)" tab!
      await prisma.$transaction(async (tx) => {
        const currentNotes = order.notes || "";
        await tx.order.update({
          where: { id: orderId },
          data: {
            isPaid: true,
            status: "cancelled",
            notes: `${currentNotes} [NEED_REFUND: Rejected by ${adminName} after payment received]`.trim(),
          },
        });

        await tx.orderDay.updateMany({
          where: { orderId: order.id },
          data: {
            status: "cancelled",
            cancelledAt: new Date(),
            cancelReason: `Cancelled by ${adminName} (Money received - refund required)`,
          },
        });

        // Cancel in sheets if any day tabs exist
        for (const d of order.days) {
          const date = d.deliveryDate;
          const monthKey = `${String(date.getUTCMonth() + 1).padStart(2, "0")}.${date.getUTCFullYear()}`;
          const tabName = `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

          await enqueueOutboxJob(tx, "CANCEL_ORDER_IN_SHEETS", {
            orderId: order.id,
            monthKey,
            tabName,
          });
        }

        const firstDate = order.days[0]?.deliveryDate || order.deliveryDate;
        await enqueueOutboxJob(tx, "TELEGRAM_ALERT_CANCELLATION", {
          orderId: order.id,
          dayDate: firstDate.toISOString(),
          cancelledBy: `Адміністратор (${adminName}) [ВІДМОВА ПІСЛЯ ОПЛАТИ]`,
          isRefundNeeded: true,
          balanceDaysRefunded: false,
        });
      });

      processAllOutboxJobs().catch((err) => console.error("Async outbox error after rejectOrderPayment:", err));
    }

    revalidatePath("/admin/pending-payments");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/today");

    return { ok: true, moneyReceived };
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

export async function resolveRefundNoPaymentAction(orderId: string) {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Unauthorized" };
  }
  const adminName = admin.name || "Admin";

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { days: true },
    });

    if (!order) {
      return { ok: false, error: "Замовлення не знайдено" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.orderDay.updateMany({
        where: {
          orderId: order.id,
          status: "cancelled",
        },
        data: {
          cancelReason: `[RESOLVED: NO_PAYMENT_RECEIVED by ${adminName} at ${new Date().toISOString()}]`,
        },
      });

      const currentNotes = order.notes || "";
      await tx.order.update({
        where: { id: order.id },
        data: {
          notes: `${currentNotes} [RESOLVED: No payment received confirmed by ${adminName}]`.trim(),
        },
      });
    });

    revalidatePath("/admin/pending-payments");
    revalidatePath("/admin/orders");

    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to resolve refund no payment:", error);
    return { ok: false, error: "Помилка при збереженні статусу" };
  }
}

export async function resolveSubscriptionRefundWithPayoutAction(purchaseId: string) {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Unauthorized" };
  }
  const adminName = admin.name || "Admin";

  try {
    const purchase = await prisma.subscriptionPurchase.findUnique({
      where: { id: purchaseId },
      include: { user: true },
    });

    if (!purchase) {
      return { ok: false, error: "Абонемент не знайдено" };
    }

    await prisma.subscriptionPurchase.update({
      where: { id: purchaseId },
      data: {
        confirmedBy: `[RESOLVED: REFUNDED_MANUALLY by ${adminName} at ${new Date().toISOString()}]`,
        confirmedAt: new Date(),
      },
    });

    if (purchase.user?.chatId) {
      try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token) {
          const text = `💸 <b>Повернення коштів за абонемент</b>\n\nКошти за абонемент <b>${purchase.packageId} (${purchase.days} дн.)</b> на суму <b>${purchase.finalPrice} ₴</b> успішно повернено за вашими реквізитами. Дякуємо!`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: purchase.user.chatId, text, parse_mode: "HTML" }),
          });
        }
      } catch (err) {
        console.error("Failed to notify user about subscription payout refund:", err);
      }
    }

    revalidatePath("/admin/pending-payments");
    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to resolve subscription payout refund:", error);
    return { ok: false, error: "Помилка при збереженні статусу повернення" };
  }
}

export async function resolveSubscriptionRefundWithBalanceAction(purchaseId: string) {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Unauthorized" };
  }
  const adminName = admin.name || "Admin";

  try {
    const purchase = await prisma.subscriptionPurchase.findUnique({
      where: { id: purchaseId },
      include: { user: true },
    });

    if (!purchase) {
      return { ok: false, error: "Абонемент не знайдено" };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Credit days to user balance
      await tx.userBalance.upsert({
        where: {
          userId_packageId: {
            userId: purchase.userId,
            packageId: purchase.packageId,
          },
        },
        create: {
          userId: purchase.userId,
          packageId: purchase.packageId,
          totalDays: purchase.days,
          usedDays: 0,
        },
        update: {
          totalDays: { increment: purchase.days },
        },
      });

      // 2. Mark subscription as resolved & paid
      await tx.subscriptionPurchase.update({
        where: { id: purchaseId },
        data: {
          status: "PAID",
          confirmedBy: `[RESOLVED: BALANCE_CREDITED (+${purchase.days}d) by ${adminName} at ${new Date().toISOString()}]`,
          confirmedAt: new Date(),
        },
      });
    });

    if (purchase.user?.chatId) {
      try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token) {
          const text = `✅ <b>Активація абонемента</b>\n\nВам нараховано <b>+${purchase.days} дн.</b> тарифу <b>${purchase.packageId}</b> на баланс абонемента!\nТепер ви можете обрати будь-які дати в особистому кабінеті.`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: purchase.user.chatId, text, parse_mode: "HTML" }),
          });
        }
      } catch (err) {
        console.error("Failed to notify user about subscription balance credit:", err);
      }
    }

    revalidatePath("/admin/pending-payments");
    revalidatePath("/admin/clients");
    revalidatePath("/profile");

    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to resolve subscription refund with balance:", error);
    return { ok: false, error: "Помилка при нарахуванні днів на баланс" };
  }
}

export async function resolveSubscriptionRefundNoPaymentAction(purchaseId: string) {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Unauthorized" };
  }
  const adminName = admin.name || "Admin";

  try {
    await prisma.subscriptionPurchase.update({
      where: { id: purchaseId },
      data: {
        confirmedBy: `[RESOLVED: NO_PAYMENT_RECEIVED by ${adminName} at ${new Date().toISOString()}]`,
        confirmedAt: new Date(),
      },
    });

    revalidatePath("/admin/pending-payments");
    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to resolve subscription no payment:", error);
    return { ok: false, error: "Помилка при збереженні статусу" };
  }
}

