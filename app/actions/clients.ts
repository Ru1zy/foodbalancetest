"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";

export type UpdateClientResult =
  | { ok: true }
  | { ok: false; message: string };

export async function updateClientInfo(
  userId: string,
  data: {
    address?: string;
    notes?: string;
  }
): Promise<UpdateClientResult> {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return {
      ok: false,
      message: "Доступ заборонено. Увійдіть як адміністратор.",
    };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });

    revalidatePath("/admin/clients");
    return { ok: true };
  } catch (error) {
    console.error("updateClientInfo failed", error);
    return {
      ok: false,
      message: "Не вдалося оновити дані клієнта.",
    };
  }
}

export async function unlinkTelegramAccount(
  userId: string
): Promise<UpdateClientResult> {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return {
      ok: false,
      message: "Доступ заборонено. Увійдіть як адміністратор.",
    };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        chatId: null,
      },
    });

    revalidatePath("/admin/clients");
    return { ok: true };
  } catch (error) {
    console.error("unlinkTelegramAccount failed", error);
    return {
      ok: false,
      message: "Не вдалося відв'язати Telegram акаунт.",
    };
  }
}
