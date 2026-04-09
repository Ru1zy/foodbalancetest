"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";

export async function updateMenuPhoto(menuId: string, photoUrl: string) {
  try {
    await prisma.menu.update({
      where: { id: menuId },
      data: { photoUrl },
    });

    revalidatePath("/");
    revalidatePath("/admin/menu");

    return { ok: true };
  } catch (error) {
    console.error("Failed to update menu photo:", error);
    return { ok: false, error: "Failed to update photo" };
  }
}

export async function getAllMenuItems() {
  try {
    const items = await prisma.menu.findMany({
      orderBy: [{ dayOfWeek: "asc" }, { packageType: "asc" }],
    });
    return items;
  } catch (error) {
    console.error("Failed to fetch menu items:", error);
    return [];
  }
}
