"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { Prisma } from "@prisma/client";

export async function updateMenuPhoto(menuId: string, photoUrl: string) {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    throw new Error("Unauthorized: Admin access required");
  }

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

export type UpdateMenuDishesResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      message: string;
    };

export async function updateMenuDishes(
  id: string,
  dishesPayload: Prisma.InputJsonValue
): Promise<UpdateMenuDishesResult> {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return {
      ok: false,
      message: "Недостатньо прав для редагування меню.",
    };
  }

  try {
    await prisma.menu.update({
      where: { id },
      data: {
        dishes: dishesPayload,
      },
    });

    revalidatePath("/admin/menu");

    return { ok: true };
  } catch (error) {
    console.error("updateMenuDishes failed", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Не вдалося оновити меню.",
    };
  }
}
