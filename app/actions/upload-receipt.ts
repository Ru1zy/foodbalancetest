"use server";

import { uploadPublicObject } from "@/lib/storage";

const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadReceiptAction(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file) {
    return { ok: false, error: "Файл не надано" };
  }

  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Некоректний формат файлу. Будь ласка, завантажте зображення (PNG, JPG, WEBP)." };
  }

  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    return { ok: false, error: "Розмір файлу завеликий. Максимальний розмір — 10 МБ." };
  }

  try {
    const result = await uploadPublicObject(file, { prefix: "receipts" });
    return { ok: true, url: result.url };
  } catch (error: unknown) {
    console.error("Failed to upload receipt:", error);
    const message = error instanceof Error ? error.message : "Не вдалося завантажити квитанцію";
    return { ok: false, error: message };
  }
}

