"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { verifyAuthToken } from "@/lib/auth-token";
import prisma from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone-utils";

export async function updateUserProfile(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    throw new Error("Not authenticated");
  }

  let userId: string;
  try {
    const payload = await verifyAuthToken(token);
    if (!payload) {
      throw new Error("Invalid token");
    }
    userId = payload;
  } catch {
    throw new Error("Invalid token");
  }

  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const cutlery = parseInt(formData.get("cutlery") as string) || 0;

  if (!name || (name || '').trim().length === 0) {
    throw new Error("Name is required");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: (name || '').trim(),
      phone: phone ? normalizePhone(phone) : undefined,
      address: (address || '').trim() || undefined,
      defaultCutlery: String(cutlery),
    },
  });

  revalidatePath("/profile");
}