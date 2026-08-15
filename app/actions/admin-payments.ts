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
  } catch (error: any) {
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
  } catch (error: any) {
    console.error("Failed to reject payment:", error);
    return { ok: false, error: "Помилка при скасуванні оплати" };
  }
}
