"use client";

import { useState } from "react";
import { updateMenuPhoto } from "@/app/actions/menu-impl";

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

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();

      const result = await updateMenuPhoto(menuId, data.url);

      if (result.ok) {
        setPhotoUrl(data.url);
      } else {
        throw new Error(result.error || "Failed to update menu");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload image");
    } finally {
      setUploading(false);
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
        {uploading && <p className="mt-1 text-xs text-blue-600">Uploading...</p>}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
