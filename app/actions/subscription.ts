"use server";

import { verifyAuthToken } from "@/lib/auth-token";
import prisma from "@/lib/prisma";
import { calculateSubscriptionPrice } from "@/lib/subscription-logic";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { enqueueOutboxJob, processAllOutboxJobs } from "@/lib/outbox";

import { createMonobankInvoice, calculateAmountWithFee } from "@/lib/monobank";

export async function createSubscriptionPurchaseAction(
  packageId: string,
  days: number,
  paymentMethod: "bank_transfer" | "cash" | "plata",
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

  // Fetch true base price from database to prevent price spoofing
  const tariff = await prisma.tariff.findUnique({
    where: { name: packageId }
  });

  if (!tariff) {
    return { ok: false, error: "Тариф не знайдено" };
  }
  
  const basePrice = tariff.basePrice;

  // Validate the days
  if (days < 2) {
    return { ok: false, error: "Мінімальна кількість днів: 2" };
  }
  if (days > 30) {
    return { ok: false, error: "Максимальна кількість днів: 30" };
  }

  // Trial restriction: max once per user, and ONLY for new clients
  if (days === 2) {
    const existingOrder = await prisma.order.findFirst({
      where: {
        userId,
        status: { not: "CANCELLED" },
      },
    });
    const existingSubscription = await prisma.subscriptionPurchase.findFirst({
      where: {
        userId,
        status: { not: "CANCELLED" },
      },
    });
    if (existingOrder || existingSubscription) {
      return { ok: false, error: "Пробний тариф на 2 дні доступний лише один раз для нових клієнтів." };
    }
  }

  // Sushka restriction: max 14 days
  if (packageId.toLowerCase().includes("sushka") && days > 14) {
    return { ok: false, error: "Для програми Сушка максимальна кількість днів: 14" };
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
    const isPlata = paymentMethod === "plata";
    let pageUrl: string | undefined;

    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.subscriptionPurchase.create({
        data: {
          userId: userId,
          packageId,
          days,
          basePrice: basePrice * days,
          discount: discountAmount,
          finalPrice: totalDiscounted,
          status: isPlata ? "PENDING" : "CREDITED_PENDING_CONFIRMATION",
          paymentMethod,
          receiptUrl: receiptUrl || null,
          sendEmailReceipt,
          receiptEmail: receiptEmail || null,
        },
      });

      if (!isPlata) {
        // Credit the balance immediately for cash/bank_transfer
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
      }

      return p;
    });

    if (isPlata) {
      // Monobank integration
      const grossAmount = calculateAmountWithFee(totalDiscounted);
      const invoice = await createMonobankInvoice({
        // amount: grossAmount * 100, // convert UAH to kopecks
        amount: 100, // TEMP: Override to 1 UAH for testing!
        reference: purchase.id,
        destination: `Оплата підписки на ${days} днів (${packageId}) [TEST]`,
        redirectPath: "/profile",
      });
      pageUrl = invoice.pageUrl;
    } else {
      revalidatePath("/profile");
      revalidatePath("/admin/pending-payments");
      processAllOutboxJobs().catch((err) => {
        console.error("processAllOutboxJobs error in subscription:", err);
      });
    }

    return { 
      ok: true, 
      purchaseId: purchase.id, 
      pageUrl,
      purchase: {
        id: purchase.id,
        packageId: purchase.packageId,
        days: purchase.days,
        finalPrice: purchase.finalPrice,
        status: purchase.status,
        createdAt: purchase.createdAt,
      }
    };
  } catch (error: any) {
    console.error("Failed to create subscription purchase:", error);
    return { ok: false, error: error.message || "Internal Server Error" };
  }
}


export async function cancelSubscriptionPurchaseAction(purchaseId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (!token) {
    return { ok: false, error: "Unauthorized" };
  }

  const userId = await verifyAuthToken(token);
  if (!userId) {
    return { ok: false, error: "Invalid token" };
  }

  try {
    const purchase = await prisma.subscriptionPurchase.findUnique({
      where: { id: purchaseId }
    });

    if (!purchase || purchase.userId !== userId) {
      return { ok: false, error: "Покупку не знайдено" };
    }

    if (purchase.status === "PAID" || purchase.status === "CANCELLED") {
      return { ok: false, error: "Цю покупку вже не можна скасувати" };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Оновити статус на CANCELLED
      await tx.subscriptionPurchase.update({
        where: { id: purchaseId },
        data: {
          status: "CANCELLED",
        },
      });

      // 2. Повернути дні з балансу, якщо вони вже були зараховані
      // (тільки якщо статус був CREDITED_PENDING_CONFIRMATION)
      if (purchase.status === "CREDITED_PENDING_CONFIRMATION") {
        await tx.userBalance.updateMany({
          where: {
            userId: purchase.userId,
            packageId: purchase.packageId,
          },
          data: {
            totalDays: { decrement: purchase.days },
          },
        });
      }
    });

    revalidatePath("/profile");
    revalidatePath("/admin/pending-payments");

    return { ok: true };
  } catch (error) {
    console.error("Failed to cancel subscription purchase:", error);
    return { ok: false, error: "Internal Server Error" };
  }
}

