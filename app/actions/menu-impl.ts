"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import type { Menu } from "@prisma/client";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { type MenuItem } from "@/lib/menu-types";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export async function getMenuItems(selectedPackage: string | null): Promise<MenuItem[]> {
  try {
    const isSushka = selectedPackage?.toLowerCase().includes("sushka") || false;
    const filterType = isSushka ? "Sushka" : "Template";

    const menuItems = await prisma.menu.findMany({
      where: {
        packageType: filterType,
      },
    });

    return menuItems.map((item: Menu) => ({
      id: item.id,
      dayOfWeek: item.dayOfWeek || 0,
      packageType: (item.packageType as string) || "Standard",
      photoUrl: item.photoUrl || null,
      dishes: (item.dishes as unknown as MenuItem["dishes"]) || { breakfast: [], lunch: [], dinner: [], snack: [] },
    })) as MenuItem[];
  } catch (error) {
    console.error("Error fetching menu items:", error);
    return [];
  }
}

export async function getAllMenuItems(): Promise<MenuItem[]> {
  try {
    const menuItems = await prisma.menu.findMany({
      orderBy: [{ packageType: "asc" }, { dayOfWeek: "asc" }],
    });
    return menuItems.map((item: Menu) => ({
      id: item.id,
      dayOfWeek: item.dayOfWeek || 0,
      packageType: item.packageType,
      photoUrl: item.photoUrl || null,
      dishes: (item.dishes as unknown as MenuItem["dishes"]) || { breakfast: [], lunch: [], dinner: [], snack: [] },
    })) as MenuItem[];
  } catch (error) {
    console.error("getAllMenuItems failed", error);
    return [];
  }
}

export async function updateMenuDishes(menuId: string, dishes: JsonValue) {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return { ok: false, message: "Доступ заборонено: потрібні права адміністратора." };
  }

  try {
    await prisma.menu.update({
      where: { id: menuId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { dishes: dishes as any },
    });
    revalidatePath("/admin/menu");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    console.error("updateMenuDishes failed", error);
    return { ok: false, message: "Помилка при оновленні страв" };
  }
}

export async function updateMenuPhoto(menuId: string, photoUrl: string | null) {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    return { ok: false, error: "Доступ заборонено: потрібні права адміністратора." };
  }

  try {
    await prisma.menu.update({
      where: { id: menuId },
      data: { photoUrl },
    });
    revalidatePath("/admin/menu");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    console.error("updateMenuPhoto failed", error);
    return { ok: false, error: "Помилка при оновленні фото" };
  }
}

export async function getTariffs() {
  try {
    const tariffs = await prisma.tariff.findMany({
      orderBy: { name: "asc" },
    });
    return tariffs;
  } catch (error) {
    console.error("Error fetching tariffs:", error);
    return [];
  }
}
