"use client";

import type { PackageType } from "@/lib/order-logic";
import { useOrderStore } from "@/lib/orderStore";

const PACKAGE_CARDS: {
  id: PackageType;
  title: string;
  kcal: string;
  price: string;
}[] = [
  { id: "Slim", title: "Slim", kcal: "≈ 1450–1650 ккал", price: "від 450 ₴" },
  { id: "Balance", title: "Balance", kcal: "≈ 1750–1950 ккал", price: "від 520 ₴" },
  { id: "Active", title: "Active", kcal: "≈ 2100–2350 ккал", price: "від 580 ₴" },
  { id: "Sport", title: "Sport Active+", kcal: "≈ 2500–2800 ккал", price: "від 640 ₴" },
  { id: "Sushka", title: "Сушка XS", kcal: "≈ 1600–1800 ккал", price: "від 490 ₴" },
  { id: "Indiv", title: "Індивідуальний", kcal: "За вашим планом", price: "від 550 ₴" },
];

export default function PackageSelector() {
  const selectedPackage = useOrderStore((s) => s.selectedPackage);
  const selectWizardPackage = useOrderStore((s) => s.selectWizardPackage);

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
      <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">Оберіть тариф</h2>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {PACKAGE_CARDS.map((pkg) => {
          const active = selectedPackage === pkg.id;
          return (
            <div
              key={pkg.id}
              className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ring-1 transition ${
                active ? "border-blue-400 ring-blue-200" : "border-gray-200 ring-gray-100"
              }`}
            >
              <div className="h-48 w-full bg-gray-200" />
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{pkg.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{pkg.kcal}</p>
                  <p className="text-sm font-semibold text-gray-800">{pkg.price}</p>
                </div>
                <button
                  type="button"
                  onClick={() => selectWizardPackage(pkg.id)}
                  className="mt-auto rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
                >
                  Обрати
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
