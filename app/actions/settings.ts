"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { SITE_CONFIG } from "@/lib/site-config";

export interface PublicSettings {
  ibanDetails: string;
  contactPhone: string | null;
  instagramUrl: string;
  telegramUrl: string;
  tiktokUrl: string;
}

export interface AdminSettingsFormData {
  ibanDetails: string;
  contactPhone: string;
  instagramUrl: string;
  telegramUrl: string;
  tiktokUrl: string;
}

/**
 * Fetch public settings for checkout, profile, and footer.
 * Fast query from DB with fallback to SITE_CONFIG defaults.
 */
export async function getPublicSettings(): Promise<PublicSettings> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ["ibanDetails", "contactPhone", "instagramUrl", "telegramUrl", "tiktokUrl"],
        },
      },
    });

    const map = new Map<string, string>();
    settings.forEach((s) => map.set(s.key, s.value));

    return {
      ibanDetails: map.get("ibanDetails")?.trim() || SITE_CONFIG.ibanDetails,
      contactPhone: map.get("contactPhone")?.trim() || SITE_CONFIG.phone,
      instagramUrl: map.get("instagramUrl")?.trim() || SITE_CONFIG.instagram,
      telegramUrl: map.get("telegramUrl")?.trim() || SITE_CONFIG.telegram,
      tiktokUrl: map.get("tiktokUrl")?.trim() || SITE_CONFIG.tiktok,
    };
  } catch (error) {
    console.error("Failed to load public settings from DB, using fallback:", error);
    return {
      ibanDetails: SITE_CONFIG.ibanDetails,
      contactPhone: SITE_CONFIG.phone,
      instagramUrl: SITE_CONFIG.instagram,
      telegramUrl: SITE_CONFIG.telegram,
      tiktokUrl: SITE_CONFIG.tiktok,
    };
  }
}

/**
 * Fetch settings for the admin panel.
 */
export async function getAdminSettingsAction(): Promise<{
  ok: boolean;
  settings?: AdminSettingsFormData;
  error?: string;
}> {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const settings = await prisma.systemSetting.findMany();
    const map = new Map<string, string>();
    settings.forEach((s) => map.set(s.key, s.value));

    return {
      ok: true,
      settings: {
        ibanDetails: map.get("ibanDetails") ?? SITE_CONFIG.ibanDetails,
        contactPhone: map.get("contactPhone") ?? (SITE_CONFIG.phone || ""),
        instagramUrl: map.get("instagramUrl") ?? SITE_CONFIG.instagram,
        telegramUrl: map.get("telegramUrl") ?? SITE_CONFIG.telegram,
        tiktokUrl: map.get("tiktokUrl") ?? SITE_CONFIG.tiktok,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load settings";
    console.error("getAdminSettingsAction error:", error);
    return { ok: false, error: message };
  }
}

/**
 * Save settings from the admin panel.
 */
export async function updateAdminSettingsAction(data: Partial<AdminSettingsFormData>): Promise<{
  ok: boolean;
  error?: string;
}> {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const entries: [string, string | undefined][] = [
      ["ibanDetails", data.ibanDetails],
      ["contactPhone", data.contactPhone],
      ["instagramUrl", data.instagramUrl],
      ["telegramUrl", data.telegramUrl],
      ["tiktokUrl", data.tiktokUrl],
    ];

    await prisma.$transaction(
      entries.map(([key, val]) =>
        prisma.systemSetting.upsert({
          where: { key },
          create: { key, value: val?.trim() || "" },
          update: { value: val?.trim() || "" },
        })
      )
    );

    revalidatePath("/");
    revalidatePath("/checkout");
    revalidatePath("/profile");
    revalidatePath("/admin/settings");

    return { ok: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save settings";
    console.error("updateAdminSettingsAction error:", error);
    return { ok: false, error: message };
  }
}
