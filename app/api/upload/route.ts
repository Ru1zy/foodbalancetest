import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { getStorageEnv, uploadPublicObject } from "@/lib/storage";

// Only admins may upload, and only images up to MAX_UPLOAD_BYTES.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export async function POST(request: NextRequest) {
  try {
    const adminUser = await getAuthenticatedAdminUser();
    if (!adminUser) {
      return NextResponse.json(
        { error: "Доступ заборонено: потрібні права адміністратора." },
        { status: 401 },
      );
    }

    // Fail fast with a clear message if storage isn't configured yet.
    if (!getStorageEnv()) {
      return NextResponse.json(
        { error: "Сховище зображень не налаштоване на сервері." },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Файл не вибрано." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Підтримуються лише JPG, PNG, WebP, GIF та AVIF." },
        { status: 415 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Файл завеликий. Максимальний розмір — 5 МБ." },
        { status: 413 }
      );
    }

    // Upload to the configured S3-compatible bucket (Supabase/R2/B2/MinIO).
    const uploaded = await uploadPublicObject(file, { prefix: "uploads" });

    return NextResponse.json({
      url: uploaded.url,
      pathname: uploaded.pathname,
      contentType: uploaded.contentType,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Не вдалося завантажити файл у сховище." },
      { status: 500 }
    );
  }
}
