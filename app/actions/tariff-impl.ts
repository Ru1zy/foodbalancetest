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

export const PROMO_MATERIAL_KEYS = [
  {
    key: "promo_programs_overview",
    title: "Огляд програм та калоражу",
    description: "Загальний флаєр з усіма програмами та формулою розрахунку калоражу",
    defaultUrl: "/images/rations/programs-overview.jpg",
  },
  {
    key: "promo_extra_calories",
    title: "Раціони понад 2500 ккал",
    description: "Інфо-слайд про добір калорій (+35 ₴ за кожні 100 ккал)",
    defaultUrl: "/images/rations/extra-calories.jpg",
  },
  {
    key: "sushka_slide_for_whom",
    title: "Сушка: Кому підходить?",
    description: "Слайд 1 презентації експрес-курсу Сушка Light",
    defaultUrl: "/images/sushka/for-whom.jpg",
  },
  {
    key: "sushka_slide_duration",
    title: "Сушка: Терміни курсу",
    description: "Слайд 2 презентації: оптимальна тривалість 7-14 днів",
    defaultUrl: "/images/sushka/duration.jpg",
  },
  {
    key: "sushka_slide_tariffs_info",
    title: "Сушка: Особливості раціону",
    description: "Слайд 3 презентації: білковий раціон XS (3 прийоми) та S (4 прийоми)",
    defaultUrl: "/images/sushka/tariffs-info.jpg",
  },
];

export async function getPromoMaterialsAction() {
  try {
    const keys = PROMO_MATERIAL_KEYS.map((p) => p.key);
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    });
    const map = new Map<string, string>();
    settings.forEach((s) => map.set(s.key, s.value));

    return PROMO_MATERIAL_KEYS.map((item) => ({
      ...item,
      url: map.get(item.key) || item.defaultUrl,
    }));
  } catch (error) {
    console.error("Failed to get promo materials:", error);
    return PROMO_MATERIAL_KEYS.map((item) => ({
      ...item,
      url: item.defaultUrl,
    }));
  }
}

export async function updatePromoMaterialAction(key: string, url: string) {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    throw new Error("Unauthorized: Admin access required");
  }

  try {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: url },
      update: { value: url },
    });

    revalidatePath("/admin/tariffs");
    revalidatePath("/");

    return { ok: true };
  } catch (error) {
    console.error("Failed to update promo material:", error);
    return { ok: false, error: "Failed to update promo material" };
  }
}


