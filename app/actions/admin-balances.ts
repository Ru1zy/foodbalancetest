"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";

export async function updateUserBalance(
  targetUserId: string,
  packageId: string,
  daysToAdd: number
) {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return { ok: false, message: "Доступ заборонено" };
  }

  try {
    const currentBalance = await prisma.userBalance.findUnique({
      where: {
        userId_packageId: {
          userId: targetUserId,
          packageId,
        },
      },
    });

    const newTotal = Math.max((currentBalance?.totalDays || 0) + daysToAdd, currentBalance?.usedDays || 0);

    await prisma.userBalance.upsert({
      where: {
        userId_packageId: {
          userId: targetUserId,
          packageId,
        },
      },
      update: {
        totalDays: newTotal,
      },
      create: {
        userId: targetUserId,
        packageId,
        totalDays: Math.max(0, daysToAdd),
        usedDays: 0,
      },
    });

    revalidatePath("/admin/clients");
    revalidatePath("/profile");

    return { ok: true, newTotal };
  } catch (error) {
    console.error("updateUserBalance failed", error);
    return { ok: false, message: "Помилка оновлення балансу" };
  }
}

export async function resetUserBalance(targetUserId: string, packageId: string) {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return { ok: false, message: "Доступ заборонено" };
  }

  try {
    await prisma.userBalance.delete({
      where: {
        userId_packageId: {
          userId: targetUserId,
          packageId,
        },
      },
    });

    revalidatePath("/admin/clients");
    revalidatePath("/profile");

    return { ok: true };
  } catch (error) {
    console.error("resetUserBalance failed", error);
    return { ok: false, message: "Помилка видалення балансу" };
  }
}
