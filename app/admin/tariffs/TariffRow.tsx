"use client";

import { useState } from "react";
import { updateTariff } from "@/app/actions/tariff-impl";

type Tariff = {
  id: string;
  name: string;
  title: string;
  kcal: string;
  price: string;
  basePrice: number;
  imageUrl: string | null;
};

type Props = {
  tariff: Tariff;
};

export default function TariffRow({ tariff }: Props) {
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: tariff.title,
    kcal: tariff.kcal,
    price: tariff.price,
    basePrice: tariff.basePrice,
  });

  const handleSave = async () => {
    await updateTariff(tariff.id, formData);
    setEditing(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      await updateTariff(tariff.id, { imageUrl: data.url });
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  if (editing) {
    return (
      <tr className="bg-blue-50">
        <td className="px-6 py-4 text-sm font-medium text-gray-900">{tariff.name}</td>
        <td className="px-6 py-4">
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </td>
        <td className="px-6 py-4">
          <input
            type="text"
            value={formData.kcal}
            onChange={(e) => setFormData({ ...formData, kcal: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </td>
        <td className="px-6 py-4">
          <input
            type="text"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </td>
        <td className="px-6 py-4">
          <input
            type="number"
            value={formData.basePrice}
            onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </td>
        <td className="px-6 py-4">
          {tariff.imageUrl && (
            <img src={tariff.imageUrl} alt={tariff.title} className="h-12 w-12 rounded object-cover" />
          )}
        </td>
        <td className="px-6 py-4">
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
            >
              Зберегти
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded bg-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-400"
            >
              Скасувати
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 text-sm font-medium text-gray-900">{tariff.name}</td>
      <td className="px-6 py-4 text-sm text-gray-600">{tariff.title}</td>
      <td className="px-6 py-4 text-sm text-gray-600">{tariff.kcal}</td>
      <td className="px-6 py-4 text-sm text-gray-600">{tariff.price}</td>
      <td className="px-6 py-4 text-sm text-gray-600">{tariff.basePrice} ₴</td>
      <td className="px-6 py-4">
        {tariff.imageUrl ? (
          <img src={tariff.imageUrl} alt={tariff.title} className="h-12 w-12 rounded object-cover" />
        ) : (
          <div className="h-12 w-12 rounded bg-gray-100" />
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
          >
            Редагувати
          </button>
          <label className="cursor-pointer rounded bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700">
            {uploading ? "..." : "Фото"}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </td>
    </tr>
  );
}
