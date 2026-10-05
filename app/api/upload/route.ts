import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { getStorageEnv, uploadPublicObject } from "@/lib/storage";
import { detectImageMimeType, ALLOWED_IMAGE_MIMES } from "@/lib/file-validation";

// Only admins may upload, and only images up to MAX_UPLOAD_BYTES.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

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

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Файл завеликий. Максимальний розмір — 5 МБ." },
        { status: 413 }
      );
    }

    // Inspect binary magic bytes to verify genuine image content, never trusting client Content-Type headers alone.
    const arrayBuffer = await file.arrayBuffer();
    const headerBytes = new Uint8Array(arrayBuffer.slice(0, 32));
    const detectedMime = detectImageMimeType(headerBytes);

    if (!detectedMime || !ALLOWED_IMAGE_MIMES.has(detectedMime)) {
      return NextResponse.json(
        {
          error:
            "Непідтримуваний або небезпечний формат файлу. Дозволені лише дійсні формати зображень: JPG, PNG, WebP, GIF та AVIF.",
        },
        { status: 415 }
      );
    }

    // Guarantee the uploaded S3 object receives the cryptographically verified MIME type
    const sanitizedFile = new File([arrayBuffer], file.name, {
      type: detectedMime,
      lastModified: file.lastModified,
    });

    // Upload to the configured S3-compatible bucket (Supabase/R2/B2/MinIO).
    const uploaded = await uploadPublicObject(sanitizedFile, { prefix: "uploads" });

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
