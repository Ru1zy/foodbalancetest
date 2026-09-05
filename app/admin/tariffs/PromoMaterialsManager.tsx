"use client";

import { useState } from "react";
import { updatePromoMaterialAction } from "@/app/actions/tariff-impl";

export type PromoItem = {
  key: string;
  title: string;
  description: string;
  url: string;
  defaultUrl: string;
};

type Props = {
  initialItems: PromoItem[];
};

export default function PromoMaterialsManager({ initialItems }: Props) {
  const [items, setItems] = useState<PromoItem[]>(initialItems);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ title: string; url: string } | null>(null);

  const handleFileUpload = async (key: string, file: File) => {
    setUploadingKey(key);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Upload failed");
      }

      const data = await response.json();
      await updatePromoMaterialAction(key, data.url);

      setItems((prev) =>
        prev.map((item) => (item.key === key ? { ...item, url: data.url } : item))
      );
    } catch (error) {
      console.error("Upload error:", error);
      alert(error instanceof Error ? error.message : "Помилка при завантаженні зображення");
    } finally {
      setUploadingKey(null);
    }
  };

  const handleResetToDefault = async (key: string, defaultUrl: string) => {
    if (!confirm("Скинути це зображення до початкового стандартного?")) return;
    setUploadingKey(key);
    try {
      await updatePromoMaterialAction(key, defaultUrl);
      setItems((prev) =>
        prev.map((item) => (item.key === key ? { ...item, url: defaultUrl } : item))
      );
    } catch (error) {
      console.error("Reset error:", error);
    } finally {
      setUploadingKey(null);
    }
  };

  return (
    <div className="mt-10 rounded-2xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm ring-1 ring-gray-200 dark:ring-slate-800">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <span>🖼️</span> Промо-матеріали та інфо-слайди
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Завантажуйте та оновлюйте слайди презентації Сушки, огляди калоражу та добору понад 2500 ккал безпосередньо з адмінки.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const isUploading = uploadingKey === item.key;
          const isCustomized = item.url !== item.defaultUrl;

          return (
            <div
              key={item.key}
              className="flex flex-col rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/50 p-4 transition hover:border-gray-300 dark:hover:border-slate-700"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">{item.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                {isCustomized && (
                  <span className="shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                    Оновлено
                  </span>
                )}
              </div>

              {/* Preview Thumbnail */}
              <div
                className="group relative mb-4 h-48 w-full cursor-pointer overflow-hidden rounded-lg bg-slate-900/10 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-center justify-center"
                onClick={() => setPreviewImage({ title: item.title, url: item.url })}
                title="Натисніть для перегляду"
              >
                <img
                  src={item.url}
                  alt={item.title}
                  className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                  <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    🔍 Збільшити
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-auto flex items-center gap-2">
                <label className="flex-1 cursor-pointer rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-center text-xs font-bold text-white transition shadow-sm flex items-center justify-center gap-1.5">
                  {isUploading ? (
                    <span>Завантаження...</span>
                  ) : (
                    <>
                      <span>📤</span>
                      <span>Змінити фото</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(item.key, file);
                    }}
                    className="hidden"
                  />
                </label>

                {isCustomized && (
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => handleResetToDefault(item.key, item.defaultUrl)}
                    className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                    title="Скинути до стандартного"
                  >
                    Скинути
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <div className="mb-2 text-white text-sm font-bold bg-black/60 px-3 py-1 rounded-full">
              {previewImage.title}
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-0 right-0 -mt-3 -mr-3 h-8 w-8 rounded-full bg-white text-gray-900 font-bold flex items-center justify-center shadow-lg"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
