"use server";

import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { verifyAuthToken } from "@/lib/auth-token";
import { cookies } from "next/headers";
import { enqueueOutboxJob, processAllOutboxJobs } from "@/lib/outbox";
import { revalidatePath } from "next/cache";
import { isDeliveryDayCancellable, shouldRefundBalanceDay, calculateNewUsedDays } from "@/lib/order-logic";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  try {
    return await verifyAuthToken(token);
  } catch {
    return null;
  }
}

/**
 * Admin bypass for cancellation
 */
export async function adminCancelOrderDay(orderDayId: string) {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    throw new Error("Unauthorized");
  }
  const result = await performCancellation(orderDayId, true);
  revalidatePath("/admin/today");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/pending-payments");
  return result;
}

/**
 * User cancellation
 */
export async function userCancelOrderDay(orderDayId: string) {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");
  const result = await performCancellation(orderDayId, false, userId);
  revalidatePath("/profile");
  revalidatePath("/admin/today");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/pending-payments");
  return result;
}

async function performCancellation(orderDayId: string, isAdmin: boolean, userId?: string) {
  const res = await prisma.$transaction(async (tx) => {
    const orderDay = await tx.orderDay.findUnique({
      where: { id: orderDayId },
      include: { order: true },
    });

    if (!orderDay) throw new Error("OrderDay not found");
    if (userId && orderDay.order.userId !== userId) throw new Error("Unauthorized for this order");
    if (orderDay.status === "cancelled") throw new Error("Already cancelled");

    if (!isAdmin && !isDeliveryDayCancellable(orderDay.deliveryDate)) {
      throw new Error("Час для скасування цього дня вже минув");
    }

    // Mark OrderDay as cancelled
    await tx.orderDay.update({
      where: { id: orderDayId },
      data: { 
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: isAdmin ? "Cancelled by Admin" : "Cancelled by User" 
      },
    });

    const order = orderDay.order;

    const allDays = await tx.orderDay.findMany({
      where: { orderId: order.id }
    });

    const cancelledCount = allDays.filter(d => d.status === "cancelled" || d.id === orderDayId).length;
    
    // Only refund if we haven't refunded more than we spent from balance
    const willRefundBalance = shouldRefundBalanceDay(cancelledCount, order.balanceDaysUsed);
    if (willRefundBalance) {
      const balance = await tx.userBalance.findFirst({
        where: { userId: order.userId, packageId: order.packageType }
      });

      if (balance) {
        await tx.userBalance.update({
          where: { id: balance.id },
          data: {
            usedDays: calculateNewUsedDays(balance.usedDays)
          }
        });
      }
    }

    const activeDaysCount = allDays.length - cancelledCount;
    if (activeDaysCount === 0) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "cancelled" }
      });
    }

    const d = orderDay.deliveryDate;
    const monthKey = `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
    const tabName = `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

    await enqueueOutboxJob(tx, "CANCEL_ORDER_IN_SHEETS", {
      orderId: order.id,
      monthKey,
      tabName,
    });

    // Enqueue telegram alert to admin chat
    const hasPotentialPayment = order.isPaid || Boolean(order.receiptUrl) || order.paymentMethod === "bank_transfer";
    const isRefundNeeded = hasPotentialPayment && (order.price ?? 0) > 0 && !willRefundBalance;

    await enqueueOutboxJob(tx, "TELEGRAM_ALERT_CANCELLATION", {
      orderId: order.id,
      dayDate: orderDay.deliveryDate.toISOString(),
      cancelledBy: isAdmin ? "Адміністратор" : "Клієнт",
      isRefundNeeded,
      balanceDaysRefunded: willRefundBalance,
    });

    return { success: true };
  });

  // Trigger outbox processing asynchronously so sheets and alerts send immediately
  processAllOutboxJobs().catch(err => console.error("Outbox process error after cancellation:", err));

  return res;
}
