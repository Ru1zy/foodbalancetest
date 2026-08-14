"use server";

import { uploadPublicObject } from "@/lib/storage";
import { verifyAuthToken } from "@/lib/auth-token";
import { cookies } from "next/headers";

export async function uploadReceiptAction(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (!token) {
    return { ok: false, error: "Unauthorized" };
  }

  const userId = await verifyAuthToken(token);
  if (!userId) {
    return { ok: false, error: "Invalid token" };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { ok: false, error: "No file provided" };
  }

  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Invalid file type. Please upload an image." };
  }

  try {
    const result = await uploadPublicObject(file, { prefix: "receipts" });
    return { ok: true, url: result.url };
  } catch (error: any) {
    console.error("Failed to upload receipt:", error);
    return { ok: false, error: error.message || "Failed to upload" };
  }
}
