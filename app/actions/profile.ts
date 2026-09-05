"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { verifyAuthToken } from "@/lib/auth-token";
import prisma from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone-utils";

export type UpdateUserProfileResult =
  | { ok: true }
  | { ok: false; message: string };

const PHONE_IN_USE_MESSAGE =
  "Цей номер уже належить іншому профілю. Автоматичне об'єднання вимкнено для захисту ваших замовлень. Зверніться до підтримки для безпечного прив'язування.";

export async function updateUserProfile(
  formData: FormData,
): Promise<UpdateUserProfileResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return { ok: false, message: "Сесію завершено. Увійдіть ще раз." };
  }

  let userId: string;
  try {
    const payload = await verifyAuthToken(token);
    if (!payload) {
      return { ok: false, message: "Сесію завершено. Увійдіть ще раз." };
    }
    userId = payload;
  } catch {
    return { ok: false, message: "Сесію завершено. Увійдіть ще раз." };
  }

  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const cutlery = parseInt(formData.get("cutlery") as string) || 0;
  const notes = (formData.get("notes") as string || "").trim();

  const cleanName = (name || "").trim();
  const normalizedPhone = phone ? normalizePhone(phone) : "";

  if (!cleanName) {
    return { ok: false, message: "Вкажіть ім'я." };
  }

  if (normalizedPhone && !/^0\d{9}$/.test(normalizedPhone)) {
    return {
      ok: false,
      message: "Вкажіть український номер у форматі +380XXXXXXXXX або 0XXXXXXXXX.",
    };
  }

  if (normalizedPhone) {
    const existingUser = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== userId) {
      return { ok: false, message: PHONE_IN_USE_MESSAGE };
    }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: cleanName,
        phone: normalizedPhone || undefined,
        address: (address || "").trim() || undefined,
        defaultCutlery: String(cutlery),
        notes: notes || null,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return { ok: false, message: PHONE_IN_USE_MESSAGE };
    }

    console.error("Failed to update user profile:", error);
    return {
      ok: false,
      message: "Не вдалося зберегти зміни. Спробуйте ще раз пізніше.",
    };
  }

  revalidatePath("/profile");
  return { ok: true };
}
