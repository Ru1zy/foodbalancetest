"use client";

import type { MenuItem } from "@/lib/menu-types";
import { getSelectableMenuDayNumbers } from "@/lib/order-logic";
import { useOrderStore } from "@/lib/orderStore";
import DateSelector from "./DateSelector";
import MenuGridClient from "./MenuGridClient";
import PackageSelector from "./PackageSelector";

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
  menuItems: MenuItem[];
  tariffs: Tariff[];
};

export default function OrderWizard({ menuItems, tariffs }: Props) {
  const step = useOrderStore((s) => s.step);

  if (!menuItems.length) {
    return (
      <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
        Меню оновлюється
      </div>
    );
  }

  if (getSelectableMenuDayNumbers().length === 0) {
    return (
      <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm font-semibold text-yellow-800">
        ⚠️ Наразі замовлення закриті. Меню на наступний тиждень публікується в суботу о 12:00 (приблизно). У
        п&apos;ятницю замовлення не приймаються.
      </div>
    );
  }

  switch (step) {
    case 1:
      return (
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center gap-6 px-4 sm:px-6 md:px-8">
          {/* Hero Section - Visible only on Step 1 */}
          <div className="mb-8 text-center relative w-full">
            <div className="inline-block mb-6">
              <div className="mb-4 flex justify-center">
                <img src="/foodbalancelogo.png" alt="Food Balance" className="h-32 w-32 object-contain drop-shadow-sm mix-blend-multiply" />
              </div>
            </div>

            <h1 className="mb-6 text-4xl sm:text-5xl md:text-6xl font-black leading-tight tracking-tighter drop-shadow-md">
              <span className="bg-gradient-to-b from-emerald-400 to-emerald-600 bg-clip-text text-transparent">Food</span> <span className="bg-gradient-to-b from-orange-400 to-orange-600 bg-clip-text text-transparent">Balance</span>
            </h1>

            <p className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600 mb-4">
              Здорове харчування з доставкою
            </p>

            <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
              Оберіть свій ідеальний раціон харчування та отримайте свіжі страви прямо до дверей
            </p>

            {/* Stats */}
            <div className="mb-12 flex flex-wrap items-center justify-center gap-4">
              <div className="rounded-2xl px-8 py-4 border border-slate-100 bg-white shadow-md hover:border-gray-300">
                <div className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-green-400 bg-clip-text text-transparent">
                  500+
                </div>
                <div className="text-sm text-gray-500 font-medium">Задоволених клієнтів</div>
              </div>
              <div className="rounded-2xl px-8 py-4 border border-slate-100 bg-white shadow-md hover:border-gray-300">
                <div className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-green-400 bg-clip-text text-transparent">
                  1000+
                </div>
                <div className="text-sm text-gray-500 font-medium">Доставлених страв</div>
              </div>
              <div className="rounded-2xl px-8 py-4 border border-slate-100 bg-white shadow-md hover:border-gray-300">
                <div className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-green-400 bg-clip-text text-transparent">
                  100%
                </div>
                <div className="text-sm text-gray-500 font-medium">Свіжі продукты</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            {([1, 2, 3] as const).map((n) => (
              <div
                key={n}
                className={`h-2 w-8 rounded-full transition-colors ${
                  n === 1 ? "bg-emerald-500" : "bg-emerald-100"
                }`}
                aria-hidden
              />
            ))}
          </div>
          <PackageSelector tariffs={tariffs} />
        </div>
      );
    case 2:
      return (
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center gap-6 px-4 sm:px-6 md:px-8">
          <div className="flex items-center justify-center gap-2">
            {([1, 2, 3] as const).map((n) => (
              <div
                key={n}
                className={`h-2 w-8 rounded-full transition-colors ${
                  n === 2 ? "bg-emerald-500" : "bg-emerald-100"
                }`}
                aria-hidden
              />
            ))}
          </div>
          <DateSelector menuItems={menuItems} />
        </div>
      );
    case 3:
      return (
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center text-center gap-6 px-4 sm:px-6 md:px-8">
          <div className="flex items-center justify-center gap-2">
            {([1, 2, 3] as const).map((n) => (
              <div
                key={n}
                className={`h-2 w-8 rounded-full transition-colors ${
                  n === 3 ? "bg-emerald-500" : "bg-emerald-100"
                }`}
                aria-hidden
              />
            ))}
          </div>
          <MenuGridClient menuItems={menuItems} />
        </div>
      );
    default:
      return <PackageSelector tariffs={tariffs} />;
  }
}
