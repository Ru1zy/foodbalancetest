"use server";

import { revalidatePath, updateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { getCachedTariffs } from "@/lib/cache";

export async function getAllTariffs() {
  try {
    const tariffs = await getCachedTariffs();
    // In-memory sort by name asc
    return [...tariffs].sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Failed to fetch tariffs:", error);
    return [];
  }
}

export async function updateTariff(
  id: string,
  data: {
    title?: string;
    kcal?: string;
    price?: string;
    basePrice?: number;
    previewImageUrl?: string;
    imageUrl?: string;
  }
) {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    throw new Error("Unauthorized: Admin access required");
  }

  try {
    await prisma.tariff.update({
      where: { id },
      data,
    });

    updateTag("tariffs");
    revalidatePath("/admin/tariffs");
    revalidatePath("/");

    return { ok: true };
  } catch (error) {
    console.error("Failed to update tariff:", error);
    return { ok: false, error: "Failed to update tariff" };
  }
}

