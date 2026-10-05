"use server";

import { uploadPublicObject } from "@/lib/storage";
import { headers, cookies } from "next/headers";
import { receiptUploadLimiter } from "@/lib/rate-limit";
import { verifyAuthToken } from "@/lib/auth-token";
import { detectReceiptMimeType } from "@/lib/file-validation";

const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

export async function uploadReceiptAction(formData: FormData) {
  // Rate limit uploads per user/IP
  const headerList = await headers();
  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth_token")?.value;
  const userId = authToken ? await verifyAuthToken(authToken) : null;
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimitKey = userId ? `user:${userId}` : `ip:${ip}`;

  if (!receiptUploadLimiter.check(rateLimitKey)) {
    return {
      ok: false,
      error: "Занадто багато завантажень. Будь ласка, зачекайте 10 хвилин.",
    };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { ok: false, error: "Файл не надано" };
  }

  const lowerName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");

  if (!hasValidExt || (!isImage && !isPdf)) {
    return {
      ok: false,
      error: "Некоректний формат файлу. Дозволені формати: JPG, PNG, WEBP або PDF.",
    };
  }

  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    return { ok: false, error: "Розмір файлу завеликий. Максимальний розмір — 5 МБ." };
  }

  try {
    // Validate magic bytes
    const buffer = await file.arrayBuffer();
    const headerBytes = new Uint8Array(buffer.slice(0, 32));
    const detectedMime = detectReceiptMimeType(headerBytes);
    if (!detectedMime) {
      return {
        ok: false,
        error: "Вміст файлу не відповідає дозволеним типам зображень або PDF.",
      };
    }

    const sanitizedFile = new File([buffer], file.name, {
      type: detectedMime,
      lastModified: file.lastModified,
    });

    const result = await uploadPublicObject(sanitizedFile, { prefix: "receipts" });
    return { ok: true, url: result.url };
  } catch (error: unknown) {
    console.error("Failed to upload receipt:", error);
    const message = error instanceof Error ? error.message : "Не вдалося завантажити квитанцію";
    return { ok: false, error: message };
  }
}
