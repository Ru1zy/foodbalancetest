"use server";

import { verifyAdminToken } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function confirmPaymentAction(purchaseId: string) {
  const adminResult = await verifyAdminToken();
  if (!adminResult.ok) {
    return { ok: false, error: "Unauthorized" };
  }
  const adminName = adminResult.adminName || "Admin";

  try {
    await prisma.subscriptionPurchase.update({
      where: { id: purchaseId },
      data: {
        status: "PAID",
        confirmedBy: adminName,
        confirmedAt: new Date(),
      },
    });

    revalidatePath("/admin/pending-payments");
    revalidatePath("/profile");
    
    return { ok: true };
  } catch (error: any) {
    console.error("Failed to confirm payment:", error);
    return { ok: false, error: "Помилка при підтвердженні оплати" };
  }
}

export async function rejectPaymentAction(purchaseId: string) {
  const adminResult = await verifyAdminToken();
  if (!adminResult.ok) {
    return { ok: false, error: "Unauthorized" };
  }
  const adminName = adminResult.adminName || "Admin";

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
      await tx.userBalance.update({
        where: {
          userId_packageId: { userId: purchase.userId, packageId: purchase.packageId },
        },
        data: {
          totalDays: { decrement: purchase.days },
        },
      });
    });

    revalidatePath("/admin/pending-payments");
    revalidatePath("/profile");
    
    return { ok: true };
  } catch (error: any) {
    console.error("Failed to reject payment:", error);
    return { ok: false, error: "Помилка при скасуванні оплати" };
  }
}
