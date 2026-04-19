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
  previewImageUrl: string | null;
  imageUrl: string | null;
};

type Props = {
  tariff: Tariff;
};

export default function TariffRow({ tariff }: Props) {
  const [editing, setEditing] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [uploadingDetail, setUploadingDetail] = useState(false);
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

  const handlePreviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPreview(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      await updateTariff(tariff.id, { previewImageUrl: data.url });
      window.location.reload();
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setUploadingPreview(false);
    }
  };

  const handleDetailImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDetail(true);
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
      window.location.reload();
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setUploadingDetail(false);
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
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </td>
        <td className="px-6 py-4">
          <input
            type="text"
            value={formData.kcal}
            onChange={(e) => setFormData({ ...formData, kcal: e.target.value })}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </td>
        <td className="px-6 py-4">
          <input
            type="text"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </td>
        <td className="px-6 py-4">
          <input
            type="number"
            value={formData.basePrice}
            onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </td>
        <td className="px-6 py-4">
          <div className="flex gap-2">
            <div className="text-center">
              {tariff.previewImageUrl && (
                <img src={tariff.previewImageUrl} alt="Preview" className="h-12 w-12 rounded object-cover mb-1" />
              )}
              <div className="text-xs text-gray-500">Preview</div>
            </div>
            <div className="text-center">
              {tariff.imageUrl && (
                <img src={tariff.imageUrl} alt="Detail" className="h-12 w-12 rounded object-cover mb-1" />
              )}
              <div className="text-xs text-gray-500">Detail</div>
            </div>
          </div>
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
        <div className="flex gap-2">
          <div className="text-center">
            {tariff.previewImageUrl && (
              <img src={tariff.previewImageUrl} alt="Preview" className="h-12 w-12 rounded object-cover mb-1" />
            )}
            {!tariff.previewImageUrl && <div className="h-12 w-12 rounded bg-gray-100 mb-1" />}
            <div className="text-xs text-gray-500">Preview</div>
          </div>
          <div className="text-center">
            {tariff.imageUrl && (
              <img src={tariff.imageUrl} alt="Detail" className="h-12 w-12 rounded object-cover mb-1" />
            )}
            {!tariff.imageUrl && <div className="h-12 w-12 rounded bg-gray-100 mb-1" />}
            <div className="text-xs text-gray-500">Detail</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
          >
            Редагувати
          </button>
          <label className="cursor-pointer rounded bg-green-600 px-3 py-1 text-center text-sm text-white hover:bg-green-700">
            {uploadingPreview ? "..." : "Preview"}
            <input
              type="file"
              accept="image/*"
              onChange={handlePreviewImageUpload}
              disabled={uploadingPreview}
              className="hidden"
            />
          </label>
          <label className="cursor-pointer rounded bg-purple-600 px-3 py-1 text-center text-sm text-white hover:bg-purple-700">
            {uploadingDetail ? "..." : "Detail"}
            <input
              type="file"
              accept="image/*"
              onChange={handleDetailImageUpload}
              disabled={uploadingDetail}
              className="hidden"
            />
          </label>
        </div>
      </td>
    </tr>
  );
}
