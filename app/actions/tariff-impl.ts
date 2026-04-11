"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";

export async function getAllTariffs() {
  try {
    const tariffs = await prisma.tariff.findMany({
      orderBy: { name: "asc" },
    });
    return tariffs;
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

    revalidatePath("/admin/tariffs");
    revalidatePath("/");

    return { ok: true };
  } catch (error) {
    console.error("Failed to update tariff:", error);
    return { ok: false, error: "Failed to update tariff" };
  }
}

export async function createTariff(data: {
  name: string;
  title: string;
  kcal: string;
  price: string;
  basePrice: number;
  imageUrl?: string;
}) {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    throw new Error("Unauthorized: Admin access required");
  }

  try {
    await prisma.tariff.create({
      data,
    });

    revalidatePath("/admin/tariffs");
    revalidatePath("/");

    return { ok: true };
  } catch (error) {
    console.error("Failed to create tariff:", error);
    return { ok: false, error: "Failed to create tariff" };
  }
}
