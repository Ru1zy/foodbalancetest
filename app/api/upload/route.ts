import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Only images are allowed." },
        { status: 415 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5 MB." },
        { status: 413 }
      );
    }

    // Prepend timestamp and sanitize filename to avoid duplicates
    const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Upload to Vercel Blob with public access
    const blob = await put(uniqueFilename, file, {
      access: "public",
      addRandomSuffix: true,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
