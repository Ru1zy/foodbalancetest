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

import { PROMO_MATERIAL_KEYS } from "@/lib/promo-constants";

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

export interface TariffAddon {
  id: string;
  title: string;
  packageId: string; // "Sport" | "Slim" | "Balance" | "Active" | "Sushka" | "Indiv" | "ALL"
  price: number;
  priceType: "per_100_kcal" | "per_day" | "fixed" | "per_unit";
  unitLabel?: string;
  description?: string;
  maxLimit?: number;
  isActive: boolean;
  createdAt: string;
}

const DEFAULT_TARIFF_ADDONS: TariffAddon[] = [
  {
    id: "sport-extra-kcal",
    title: "+100 ккал до раціону (Sport Active+)",
    packageId: "Sport",
    price: 35,
    priceType: "per_100_kcal",
    unitLabel: "за 100 ккал / день",
    description:
      "Модульний лічильник у кошику до 10 кліків (+1000 ккал = 3400 ккал). Автоматично передається на кухню як Sport (XXXX ккал).",
    maxLimit: 10,
    isActive: true,
    createdAt: "2026-09-12T00:00:00.000Z",
  },
];

const ADDONS_SETTING_KEY = "package_addons_config";

export async function getTariffAddonsAction(): Promise<TariffAddon[]> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: ADDONS_SETTING_KEY },
    });

    if (!setting?.value) {
      return DEFAULT_TARIFF_ADDONS;
    }

    const parsed = JSON.parse(setting.value);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as TariffAddon[];
    }
    return DEFAULT_TARIFF_ADDONS;
  } catch (error) {
    console.error("Failed to get tariff addons:", error);
    return DEFAULT_TARIFF_ADDONS;
  }
}

export async function saveTariffAddonAction(
  addonData: Omit<TariffAddon, "id" | "createdAt"> & { id?: string; createdAt?: string }
) {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    throw new Error("Unauthorized: Admin access required");
  }

  try {
    const currentAddons = await getTariffAddonsAction();
    const id = addonData.id || `addon_${Date.now()}`;
    const now = new Date().toISOString();

    const existingIndex = currentAddons.findIndex((a) => a.id === id);
    let updatedList: TariffAddon[];

    if (existingIndex >= 0) {
      updatedList = currentAddons.map((item, idx) =>
        idx === existingIndex
          ? {
              ...item,
              ...addonData,
              id,
              createdAt: item.createdAt || now,
            }
          : item
      );
    } else {
      const newAddon: TariffAddon = {
        ...addonData,
        id,
        createdAt: now,
      };
      updatedList = [newAddon, ...currentAddons];
    }

    await prisma.systemSetting.upsert({
      where: { key: ADDONS_SETTING_KEY },
      create: { key: ADDONS_SETTING_KEY, value: JSON.stringify(updatedList) },
      update: { value: JSON.stringify(updatedList) },
    });

    revalidatePath("/admin/tariffs");
    revalidatePath("/checkout");
    revalidatePath("/");

    return { ok: true, addons: updatedList };
  } catch (error) {
    console.error("Failed to save tariff addon:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Помилка при збереженні допу",
    };
  }
}

export async function deleteTariffAddonAction(id: string) {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    throw new Error("Unauthorized: Admin access required");
  }

  try {
    const currentAddons = await getTariffAddonsAction();
    const updatedList = currentAddons.filter((a) => a.id !== id);

    await prisma.systemSetting.upsert({
      where: { key: ADDONS_SETTING_KEY },
      create: { key: ADDONS_SETTING_KEY, value: JSON.stringify(updatedList) },
      update: { value: JSON.stringify(updatedList) },
    });

    revalidatePath("/admin/tariffs");
    revalidatePath("/checkout");
    revalidatePath("/");

    return { ok: true, addons: updatedList };
  } catch (error) {
    console.error("Failed to delete tariff addon:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Помилка при видаленні допу",
    };
  }
}

export async function toggleTariffAddonAction(id: string, isActive: boolean) {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    throw new Error("Unauthorized: Admin access required");
  }

  try {
    const currentAddons = await getTariffAddonsAction();
    const updatedList = currentAddons.map((item) =>
      item.id === id ? { ...item, isActive } : item
    );

    await prisma.systemSetting.upsert({
      where: { key: ADDONS_SETTING_KEY },
      create: { key: ADDONS_SETTING_KEY, value: JSON.stringify(updatedList) },
      update: { value: JSON.stringify(updatedList) },
    });

    revalidatePath("/admin/tariffs");
    revalidatePath("/checkout");
    revalidatePath("/");

    return { ok: true, addons: updatedList };
  } catch (error) {
    console.error("Failed to toggle tariff addon:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Помилка при зміні статусу допу",
    };
  }
}



