"use server";

import { verifyAuthToken } from "@/lib/auth-token";
import prisma from "@/lib/prisma";
import { calculateSubscriptionPrice } from "@/lib/subscription-logic";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function createSubscriptionPurchaseAction(
  packageId: string,
  basePrice: number,
  days: number
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

  // Check if user has Telegram connected
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.chatId) {
    return { ok: false, error: "Для оформлення підписки необхідно підключити Telegram бота." };
  }

  // Calculate price securely on server
  const { totalDiscounted } = calculateSubscriptionPrice(basePrice, packageId, days);
  const discountAmount = (basePrice * days) - totalDiscounted;

  try {
    const purchase = await prisma.subscriptionPurchase.create({
      data: {
        userId: userId,
        packageId,
        days,
        basePrice: basePrice * days,
        discount: discountAmount,
        finalPrice: totalDiscounted,
        status: "PENDING",
        // TODO: Update payment method selection logic
        paymentMethod: "bank_transfer",
      },
    });

    revalidatePath("/profile");

    return { ok: true, purchaseId: purchase.id };
  } catch (error) {
    console.error("Failed to create subscription purchase:", error);
    return { ok: false, error: "Internal Server Error" };
  }
}
