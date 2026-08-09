"use client";

import { useState } from "react";
import { updateMenuPhoto } from "@/app/actions/menu-impl";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

type Props = {
  menuId: string;
  currentPhotoUrl: string | null;
};

export default function MenuPhotoUpload({ menuId, currentPhotoUrl }: Props) {
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setError("Підтримуються лише JPG, PNG, WebP, GIF та AVIF.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Файл завеликий. Максимальний розмір — 5 МБ.");
      e.target.value = "";
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Не вдалося завантажити зображення.");
      }

      const result = await updateMenuPhoto(menuId, data.url);

      if (result.ok) {
        setPhotoUrl(data.url);
      } else {
        throw new Error(result.error || "Не вдалося оновити меню.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Не вдалося завантажити зображення.",
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      {photoUrl && (
        <img
          src={photoUrl}
          alt="Menu preview"
          className="h-16 w-16 rounded-lg object-cover"
        />
      )}
      <div className="flex-1">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="text-sm text-gray-600"
        />
        <p className="mt-1 text-xs text-gray-500">JPG, PNG, WebP, GIF або AVIF — до 5 МБ.</p>
        {uploading && <p className="mt-1 text-xs text-blue-600">Uploading...</p>}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
