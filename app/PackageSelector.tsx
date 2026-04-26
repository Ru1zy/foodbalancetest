"use client";

import { useState, useMemo } from "react";
import type { PackageType } from "@/lib/order-logic";
import { useOrderStore } from "@/lib/orderStore";

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
  tariffs: Tariff[];
};

export default function PackageSelector({ tariffs }: Props) {
  const selectedPackage = useOrderStore((s) => s.selectedPackage);
  const selectWizardPackage = useOrderStore((s) => s.selectWizardPackage);
  const [showSushkaOptions, setShowSushkaOptions] = useState(false);
  const [previewPkg, setPreviewPkg] = useState<Tariff | null>(null);

  // Separate tariffs into main packages and Sushka options
  const mainPackages = useMemo(() => {
    return tariffs.filter(t => !t.name.includes("Sushka"));
  }, [tariffs]);

  const sushkaOptions = useMemo(() => {
    return tariffs.filter(t => t.name === "Sushka XS" || t.name === "Sushka S");
  }, [tariffs]);

  // Check if we should show "Sushka" folder card
  const hasSushkaFolder = sushkaOptions.length > 0;

  const handleSelectPackage = (pkg: Tariff) => {
    selectWizardPackage(pkg.name as PackageType);
    setPreviewPkg(null);
    setShowSushkaOptions(false);
  };

  if (showSushkaOptions) {
    return (
      <>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {sushkaOptions.map((option) => (
            <div
              key={option.id}
              className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ring-1 transition"
            >
              <div className="relative h-48 w-full overflow-hidden bg-gray-200">
                {option.previewImageUrl ? (
                  <img
                    src={option.previewImageUrl}
                    alt={option.title}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{option.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{option.kcal}</p>
                  <p className="text-sm font-semibold text-gray-800">{option.price}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPkg(option)}
                  className="mt-auto rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
                >
                  Обрати
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setShowSushkaOptions(false);
              setPreviewPkg(null);
            }}
            className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ring-1 transition hover:border-gray-300"
          >
            <div className="relative h-48 w-full overflow-hidden bg-gray-200">
              <div className="flex h-full items-center justify-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-12 w-12">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">Назад</h3>
                <p className="mt-1 text-sm text-gray-600">Повернутися до вибору тарифу</p>
              </div>
            </div>
          </button>
        </div>

        {/* Preview Modal for Sushka options */}
        {previewPkg && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setPreviewPkg(null)}
          >
            <div
              className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-2xl font-bold text-gray-900">{previewPkg.title}</h2>

              {previewPkg.imageUrl ? (
                <div className="mb-4 overflow-hidden rounded-lg bg-gray-100">
                  <img
                    src={previewPkg.imageUrl}
                    alt={previewPkg.title}
                    className="w-full max-h-[60vh] object-contain"
                  />
                </div>
              ) : (
                <div className="mb-4 flex h-64 items-center justify-center rounded-lg bg-gray-100">
                  <p className="text-sm text-gray-500">Зображення відсутнє</p>
                </div>
              )}

              <div className="mb-6 space-y-2">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Калорійність:</span> {previewPkg.kcal}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Ціна:</span> {previewPkg.price}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewPkg(null)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  🔙 Назад
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPackage(previewPkg)}
                  className="flex-1 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
                >
                  ✅ Обрати цей тариф
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div
      key={1}
      className="transition-opacity duration-300 ease-out motion-reduce:transition-none"
    >
      <div className="mb-6 flex items-center justify-center gap-2">
        {([1, 2, 3] as const).map((n) => (
          <div
            key={n}
            className={`h-2 w-8 rounded-full transition-colors ${
              n === 1 ? "bg-blue-600" : "bg-gray-200"
            }`}
            aria-hidden
          />
        ))}
      </div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Оберіть тариф</h2>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {mainPackages.map((pkg) => {
          const active = selectedPackage === pkg.name;
          return (
            <div
              key={pkg.id}
              className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ring-1 transition ${
                active ? "border-blue-400 ring-blue-200" : "border-gray-200 ring-gray-100"
              }`}
            >
              <div className="relative h-48 w-full overflow-hidden bg-gray-200">
                {pkg.previewImageUrl && (
                  <img
                    src={pkg.previewImageUrl}
                    alt={pkg.title}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{pkg.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{pkg.kcal}</p>
                  <p className="text-sm font-semibold text-gray-800">{pkg.price}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPkg(pkg)}
                  className="mt-auto rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
                >
                  Обрати
                </button>
              </div>
            </div>
          );
        })}

        {/* Sushka folder card */}
        {hasSushkaFolder && (
          <div
            className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ring-1 transition ${
              selectedPackage?.includes("Sushka") ? "border-blue-400 ring-blue-200" : "border-gray-200 ring-gray-100"
            }`}
          >
            <div className="relative h-48 w-full overflow-hidden bg-gray-200">
              <div className="flex h-full items-center justify-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-16 w-16">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                </svg>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Сушка</h3>
                <p className="mt-1 text-sm text-gray-600">≈ 1600–1800 ккал</p>
                <p className="text-sm font-semibold text-gray-800">від 500 ₴</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSushkaOptions(true)}
                className="mt-auto rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
              >
                Обрати
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewPkg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setPreviewPkg(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-2xl font-bold text-gray-900">{previewPkg.title}</h2>

            {previewPkg.imageUrl ? (
              <div className="mb-4 overflow-hidden rounded-lg bg-gray-100">
                <img
                  src={previewPkg.imageUrl}
                  alt={previewPkg.title}
                  className="w-full max-h-[60vh] object-contain"
                />
              </div>
            ) : (
              <div className="mb-4 flex h-64 items-center justify-center rounded-lg bg-gray-100">
                <p className="text-sm text-gray-500">Зображення відсутнє</p>
              </div>
            )}

            <div className="mb-6 space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Калорійність:</span> {previewPkg.kcal}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Ціна:</span> {previewPkg.price}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPreviewPkg(null)}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                🔙 Назад
              </button>
              <button
                type="button"
                onClick={() => handleSelectPackage(previewPkg)}
                className="flex-1 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
              >
                ✅ Обрати цей тариф
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
