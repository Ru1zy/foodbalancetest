"use server";

import { verifyAuthToken } from "@/lib/auth-token";
import prisma from "@/lib/prisma";
import { calculateSubscriptionPrice } from "@/lib/subscription-logic";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { enqueueOutboxJob, processAllOutboxJobs } from "@/lib/outbox";

export async function createSubscriptionPurchaseAction(
  packageId: string,
  basePrice: number,
  days: number,
  paymentMethod: "bank_transfer" | "cash",
  receiptUrl?: string,
  sendEmailReceipt: boolean = false,
  receiptEmail?: string
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (!token) {
    return { ok: false, error: "Unauthorized" };
  }

  const userId = await verifyAuthToken(token);
  if (!userId) {
    return { ok: false, error: "Invalid token" };
  }

  // Validate the days
  if (days < 2) {
    return { ok: false, error: "Мінімальна кількість днів: 2" };
  }
  if (days > 30) {
    return { ok: false, error: "Максимальна кількість днів: 30" };
  }

  // Trial restriction: max once per user
  if (days === 2) {
    const existingTrial = await prisma.subscriptionPurchase.findFirst({
      where: {
        userId,
        days: 2,
        status: { not: "CANCELLED" },
      },
    });
    if (existingTrial) {
      return { ok: false, error: "Пробний тариф на 2 дні доступний лише один раз для нових клієнтів." };
    }
  }

  // Check if user has Telegram connected
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.chatId) {
    return { ok: false, error: "Для оформлення підписки необхідно підключити Telegram бота." };
  }

  // Calculate price securely on server
  const { totalDiscounted } = calculateSubscriptionPrice(basePrice, packageId, days);
  const discountAmount = (basePrice * days) - totalDiscounted;

  try {
    const purchase = await prisma.$transaction(async (tx) => {
      const isCash = paymentMethod === "cash";
      
      const p = await tx.subscriptionPurchase.create({
        data: {
          userId: userId,
          packageId,
          days,
          basePrice: basePrice * days,
          discount: discountAmount,
          finalPrice: totalDiscounted,
          status: isCash ? "PAID" : "CREDITED_PENDING_CONFIRMATION",
          paymentMethod,
          receiptUrl: receiptUrl || null,
          sendEmailReceipt,
          receiptEmail: receiptEmail || null,
        },
      });

      // Credit the balance immediately
      await tx.userBalance.upsert({
        where: {
          userId_packageId: { userId, packageId },
        },
        create: {
          userId,
          packageId,
          totalDays: days,
        },
        update: {
          totalDays: { increment: days },
        },
      });

      // Enqueue telegram notification for admin
      await enqueueOutboxJob(tx, "TELEGRAM_NOTIFICATION_SUBSCRIPTION", {
        purchaseId: p.id,
      });

      return p;
    });

    revalidatePath("/profile");
    revalidatePath("/admin/pending-payments");

    processAllOutboxJobs().catch((err) => {
      console.error("processAllOutboxJobs error in subscription:", err);
    });

    return { ok: true, purchaseId: purchase.id };
  } catch (error) {
    console.error("Failed to create subscription purchase:", error);
    return { ok: false, error: "Internal Server Error" };
  }
}
