"use client";

import { useState } from "react";
import Link from "next/link";

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

type PromoItem = {
  key: string;
  url: string;
};

type Props = {
  menuItems: MenuItem[];
  tariffs: Tariff[];
  promoMaterials?: PromoItem[];
  orderingMode?: "AUTO" | "FORCE_OPEN" | "FORCE_CLOSED";
  orderingCustomMessage?: string;
};

export default function OrderWizard({
  menuItems,
  tariffs,
  promoMaterials,
  orderingMode = "AUTO",
  orderingCustomMessage = "",
}: Props) {
  const step = useOrderStore((s) => s.step);
  const cartItems = useOrderStore((s) => s.cartItems);
  const [isSushkaView, setIsSushkaView] = useState(false);

  if (!menuItems.length) {
    return (
      <div className="rounded-xl bg-white dark:bg-slate-900 p-6 text-center text-gray-500 dark:text-slate-400 shadow-sm">
        Меню оновлюється
      </div>
    );
  }

  const selectableDays = getSelectableMenuDayNumbers(orderingMode);

  if (selectableDays.length === 0 || orderingMode === "FORCE_CLOSED") {
    return (
      <div className="rounded-xl border border-yellow-300 dark:border-yellow-700/60 bg-yellow-50 dark:bg-yellow-950/40 p-6 text-sm font-semibold text-yellow-800 dark:text-yellow-200 max-w-2xl mx-auto my-8 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-2xl select-none">⚠️</span>
          <div className="space-y-2">
            <p className="font-bold text-lg text-yellow-900 dark:text-yellow-100">
              {orderingMode === "FORCE_CLOSED"
                ? "Прийом замовлень тимчасово призупинено"
                : "Наразі замовлення закриті."}
            </p>
            {orderingCustomMessage ? (
              <p className="whitespace-pre-line text-yellow-950 dark:text-yellow-100 font-medium text-base">
                {orderingCustomMessage}
              </p>
            ) : (
              <>
                <p>Меню на наступний тиждень публікується в суботу о 12:00 (приблизно).</p>
                <p>У п&apos;ятницю замовлення не приймаються.</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  switch (step) {
    case 1:
      return (
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center gap-6 px-4 sm:px-6 md:px-8">
          {/* Hero Section - Visible only on Step 1 when NOT in Sushka Light program presentation */}
          {!isSushkaView && (
            <>
              <div className="mb-8 text-center relative w-full">
                <div className="inline-block mb-6">
                  <div className="mb-4 flex justify-center">
                    <div className="rounded-3xl dark:bg-white dark:p-3 drop-shadow-sm">
                      <img src="/foodbalancelogo.png" alt="Food Balance" className="h-32 w-32 object-contain mix-blend-multiply dark:mix-blend-normal" />
                    </div>
                  </div>
                </div>

                <h1 className="mb-6 text-4xl sm:text-5xl md:text-6xl font-black leading-tight tracking-tighter drop-shadow-md">
                  <span className="bg-gradient-to-b from-emerald-400 to-emerald-600 bg-clip-text text-transparent">Food</span> <span className="bg-gradient-to-b from-orange-400 to-orange-600 bg-clip-text text-transparent">Balance</span>
                </h1>

                <p className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600 dark:text-slate-400 mb-4">
                  Здорове харчування з доставкою
                </p>

                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8">
                  Оберіть свій ідеальний раціон харчування та отримайте свіжі страви прямо до дверей
                </p>

                {/* Stats */}
                <div className="mb-12 flex flex-wrap items-center justify-center gap-4">
                  <div className="rounded-2xl px-8 py-4 border border-slate-100 bg-white dark:bg-slate-900 shadow-md hover:border-gray-300 dark:border-slate-600">
                    <div className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-green-400 bg-clip-text text-transparent">
                      1 000+
                    </div>
                    <div className="text-sm text-gray-500 dark:text-slate-400 font-medium">Задоволених клієнтів</div>
                  </div>
                  <div className="rounded-2xl px-8 py-4 border border-slate-100 bg-white dark:bg-slate-900 shadow-md hover:border-gray-300 dark:border-slate-600">
                    <div className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-green-400 bg-clip-text text-transparent">
                      75 000+
                    </div>
                    <div className="text-sm text-gray-500 dark:text-slate-400 font-medium">Доставлених страв</div>
                  </div>
                  <div className="rounded-2xl px-8 py-4 border border-slate-100 bg-white dark:bg-slate-900 shadow-md hover:border-gray-300 dark:border-slate-600">
                    <div className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-green-400 bg-clip-text text-transparent">
                      100%
                    </div>
                    <div className="text-sm text-gray-500 dark:text-slate-400 font-medium">Свіжі продукти</div>
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
            </>
          )}
          <PackageSelector
            tariffs={tariffs}
            promoMaterials={promoMaterials}
            onSushkaViewChange={setIsSushkaView}
          />

          {cartItems.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-lg flex items-center justify-between dark:bg-emerald-900/90 dark:border-emerald-700">
                <div className="text-emerald-800 dark:text-emerald-100 text-sm font-semibold">
                  У кошику {cartItems.length} {cartItems.length === 1 ? "раціон" : cartItems.length >= 5 ? "раціонів" : "раціони"}
                </div>
                <Link
                  href="/checkout"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 shadow-sm"
                >
                  Оформити
                </Link>
              </div>
            </div>
          )}
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
          <DateSelector menuItems={menuItems} orderingMode={orderingMode} tariffs={tariffs} />
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
          <MenuGridClient menuItems={menuItems} orderingMode={orderingMode} />
        </div>
      );
    default:
      return <PackageSelector tariffs={tariffs} promoMaterials={promoMaterials} />;
  }
}
