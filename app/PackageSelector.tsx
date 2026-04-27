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
      <div className="w-full max-w-6xl mx-auto">
        <h2 className="mb-8 text-3xl font-black text-gray-900 text-center">Варіанти Сушки</h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {sushkaOptions.map((option) => (
            <div
              key={option.id}
              className="w-full max-w-sm mx-auto flex flex-col overflow-hidden bg-white rounded-[2rem] border border-gray-100 shadow-sm transition-transform duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)] active:scale-95"
            >
              <div className="relative h-56 w-full overflow-hidden bg-gray-50">
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
              <div className="flex flex-1 flex-col gap-4 p-6 md:p-8">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{option.title}</h3>
                  <p className="mt-2 text-base text-gray-500">{option.kcal}</p>
                  <p className="text-xl font-extrabold text-emerald-600 mt-4">{option.price}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPkg(option)}
                  className="mt-auto w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white transition hover:bg-emerald-700"
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
            className="w-full max-w-sm mx-auto flex flex-col overflow-hidden bg-white rounded-[2rem] border border-gray-100 shadow-sm transition-transform duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)] active:scale-95"
          >
            <div className="relative h-56 w-full overflow-hidden bg-gray-50">
              <div className="flex h-full items-center justify-center text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-16 w-16">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-4 p-6 md:p-8">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900">Назад</h3>
                <p className="mt-2 text-base text-gray-500">До вибору тарифу</p>
              </div>
            </div>
          </button>
        </div>

        {/* Preview Modal for Sushka options */}
        {previewPkg && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setPreviewPkg(null)}
          >
            <div
              className="relative w-full max-w-2xl rounded-[2rem] bg-white p-8 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-6 text-3xl font-bold text-gray-900">{previewPkg.title}</h2>

              {previewPkg.imageUrl ? (
                <div className="mb-6 overflow-hidden rounded-2xl bg-gray-50">
                  <img
                    src={previewPkg.imageUrl}
                    alt={previewPkg.title}
                    className="w-full max-h-[50vh] object-contain"
                  />
                </div>
              ) : (
                <div className="mb-6 flex h-64 items-center justify-center rounded-2xl bg-gray-50">
                  <p className="text-gray-500">Зображення відсутнє</p>
                </div>
              )}

              <div className="mb-8 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Калорійність</p>
                  <p className="text-lg font-bold text-gray-900">{previewPkg.kcal}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Ціна</p>
                  <p className="text-lg font-bold text-emerald-600">{previewPkg.price}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => setPreviewPkg(null)}
                  className="flex-1 rounded-xl border border-gray-200 bg-white py-4 text-lg font-bold text-gray-700 transition hover:bg-gray-50"
                >
                  🔙 Назад
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPackage(previewPkg)}
                  className="flex-1 rounded-xl bg-emerald-600 py-4 text-lg font-bold text-white transition hover:bg-emerald-700"
                >
                  ✅ Обрати тариф
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      key={1}
      className="w-full max-w-6xl mx-auto transition-opacity duration-300 ease-out motion-reduce:transition-none"
    >
      <h2 className="mb-10 text-3xl font-black text-gray-900 text-center">Оберіть тариф</h2>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {mainPackages.map((pkg) => {
          const active = selectedPackage === pkg.name;
          return (
            <div
              key={pkg.id}
              className={`w-full max-w-sm mx-auto flex flex-col overflow-hidden bg-white rounded-[2rem] border transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)] active:scale-95 ${
                active ? "border-emerald-500 ring-4 ring-emerald-50" : "border-gray-100 shadow-sm"
              }`}
            >
              <div className="relative h-56 w-full overflow-hidden bg-gray-50">
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
              <div className="flex flex-1 flex-col gap-4 p-6 md:p-8">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{pkg.title}</h3>
                  <p className="mt-2 text-base text-gray-500">{pkg.kcal}</p>
                  <p className="text-xl font-extrabold text-emerald-600 mt-4">{pkg.price}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewPkg(pkg)}
                  className="mt-auto w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white transition hover:bg-emerald-700"
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
            className={`w-full max-w-sm mx-auto flex flex-col overflow-hidden bg-white rounded-[2rem] border transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)] active:scale-95 ${
              selectedPackage?.includes("Sushka") ? "border-emerald-500 ring-4 ring-emerald-50" : "border-gray-100 shadow-sm"
            }`}
          >
            <div className="relative h-56 w-full overflow-hidden bg-gray-50">
              <img 
                src="https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&q=80&w=800" 
                alt="Sushka program" 
                className="aspect-video h-full w-full object-cover rounded-xl mb-4"
              />
            </div>
            <div className="flex flex-1 flex-col gap-4 p-6 md:p-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Сушка</h3>
                <p className="mt-2 text-base text-gray-500">≈ 1600–1800 ккал</p>
                <p className="text-xl font-extrabold text-emerald-600 mt-4">від 500 ₴</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSushkaOptions(true)}
                className="mt-auto w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white transition hover:bg-emerald-700"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreviewPkg(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-[2rem] bg-white p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-6 text-3xl font-bold text-gray-900">{previewPkg.title}</h2>

            {previewPkg.imageUrl ? (
              <div className="mb-6 overflow-hidden rounded-2xl bg-gray-50">
                <img
                  src={previewPkg.imageUrl}
                  alt={previewPkg.title}
                  className="w-full max-h-[50vh] object-contain"
                />
              </div>
            ) : (
              <div className="mb-6 flex h-64 items-center justify-center rounded-2xl bg-gray-50">
                <p className="text-gray-500">Зображення відсутнє</p>
              </div>
            )}

            <div className="mb-8 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Калорійність</p>
                <p className="text-lg font-bold text-gray-900">{previewPkg.kcal}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Ціна</p>
                <p className="text-lg font-bold text-emerald-600">{previewPkg.price}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => setPreviewPkg(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-4 text-lg font-bold text-gray-700 transition hover:bg-gray-50"
              >
                🔙 Назад
              </button>
              <button
                type="button"
                onClick={() => handleSelectPackage(previewPkg)}
                className="flex-1 rounded-xl bg-emerald-600 py-4 text-lg font-bold text-white transition hover:bg-emerald-700"
              >
                ✅ Обрати тариф
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
