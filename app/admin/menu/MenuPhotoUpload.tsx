"use client";

import { useState } from "react";
import { updateMenuPhoto } from "@/app/actions/menu-impl";
import { Upload, Loader2, Image as ImageIcon, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

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
      const msg = "Підтримуються лише формати JPG, PNG, WebP, GIF та AVIF.";
      setError(msg);
      toast.error(msg);
      e.target.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      const msg = "Файл завеликий. Максимальний дозволений розмір — 5 МБ.";
      setError(msg);
      toast.error(msg);
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
        throw new Error(data?.error || "Не вдалося завантажити зображення на сервер.");
      }

      const result = await updateMenuPhoto(menuId, data.url);

      if (result.ok) {
        setPhotoUrl(data.url);
        toast.success("Фотографію страви успішно оновлено!");
      } else {
        throw new Error(result.error || "Не вдалося зберегти нове фото в меню.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Не вдалося завантажити зображення.";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Thumbnail preview */}
      <div className="relative flex-shrink-0">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Прев'ю страви"
            className="h-14 w-14 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/10 shadow-sm"
          />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400 dark:text-slate-500 ring-1 ring-gray-200 dark:ring-slate-700">
            <ImageIcon className="w-6 h-6" />
          </div>
        )}
      </div>

      {/* Button & hint */}
      <div className="flex flex-col gap-1 min-w-[170px]">
        {uploading ? (
          <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-wait">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
            <span>Завантаження...</span>
          </span>
        ) : (
          <label className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-sm transition-all cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{photoUrl ? "Змінити фото" : "Обрати фото"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}

        <span className="text-[11px] text-gray-500 dark:text-slate-400">
          JPG, PNG, WebP — до 5 МБ
        </span>

        {error && (
          <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    </div>
  );
}
