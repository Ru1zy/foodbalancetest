"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

import type { MenuItem } from "@/lib/menu-types";
import { getSelectableMenuDayNumbers } from "@/lib/order-logic";
import { useOrderStore } from "@/lib/orderStore";
import { parsePackageType } from "@/lib/package-coerce";
import { getDaySelectedCount, isDaySelectionComplete, isIndivPackage } from "@/lib/order-selection";
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
  const selectedPackageRaw = useOrderStore((s) => s.selectedPackage);
  const selectedDates = useOrderStore((s) => s.selectedDates);
  const selections = useOrderStore((s) => s.selections);
  const resetWizard = useOrderStore((s) => s.resetWizard);
  const setStep = useOrderStore((s) => s.setStep);
  const [isSushkaView, setIsSushkaView] = useState(false);

  const { draftDays, totalDaysCount, totalPackagesCount, hasCartContent, cartLabel } = useMemo(() => {
    const pkg = parsePackageType(selectedPackageRaw);
    let draft = 0;

    if (pkg) {
      if (pkg.includes("Sushka")) {
        draft = selectedDates.length;
      } else {
        const isIndiv = isIndivPackage(selectedPackageRaw ?? undefined);
        for (const daySelections of Object.values(selections)) {
          const count = getDaySelectedCount(daySelections, pkg);
          if (isIndiv ? count >= 1 : isDaySelectionComplete(count, pkg)) {
            draft += 1;
          }
        }
      }
    }

    const addedCartDays = cartItems.reduce((sum, item) => sum + item.dayCount * item.quantity, 0);
    const addedCartPackages = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    const totalDays = addedCartDays + draft;
    const totalPackages = addedCartPackages + (draft > 0 ? 1 : 0);

    let label = "";
    if (addedCartPackages > 0 && draft > 0) {
      label = `У кошику: ${totalPackages} рац. (${totalDays} дн.)`;
    } else if (draft > 0 && selectedPackageRaw) {
      label = `У кошику: ${selectedPackageRaw} (${draft} ${draft === 1 ? "день" : draft >= 5 ? "днів" : "дні"})`;
    } else if (addedCartPackages > 0) {
      label = `У кошику ${addedCartPackages} ${addedCartPackages === 1 ? "раціон" : addedCartPackages >= 5 ? "раціонів" : "раціони"}`;
    }

    return {
      draftDays: draft,
      totalDaysCount: totalDays,
      totalPackagesCount: totalPackages,
      hasCartContent: totalDays > 0 || totalPackages > 0,
      cartLabel: label,
    };
  }, [cartItems, selectedPackageRaw, selectedDates, selections]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [step]);

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
                  <div className="mb-4 flex justify-center">
                    <img
                      src="/foodbalancelogo.png"
                      alt="Food Balance — Доставка здорового харчування та раціонів"
                      className="h-32 w-32 object-contain drop-shadow-md transition-transform duration-300 hover:scale-105"
                    />
                  </div>

                <h1 className="mb-6 text-4xl sm:text-5xl md:text-6xl font-black leading-tight tracking-tighter drop-shadow-md">
                  <span className="bg-gradient-to-b from-emerald-400 to-emerald-600 bg-clip-text text-transparent">Food</span> <span className="bg-gradient-to-b from-orange-400 to-orange-600 bg-clip-text text-transparent">Balance</span>
                  <span className="sr-only"> — Доставка здорового харчування та готових раціонів</span>
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
          {hasCartContent && (
            <div className="w-full rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/70 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
              <div className="flex items-center gap-3.5">
                <span className="text-3xl sm:text-4xl select-none">🛒</span>
                <div>
                  <div className="font-bold text-emerald-950 dark:text-emerald-100 text-base sm:text-lg">
                    {draftDays > 0 && selectedPackageRaw ? (
                      <>
                        У вас є збережене замовлення: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{selectedPackageRaw}</span> ({draftDays} {draftDays === 1 ? "день" : draftDays >= 5 ? "днів" : "дні"})
                      </>
                    ) : (
                      <>
                        У вашому кошику є збережені раціони ({totalPackagesCount})
                      </>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">
                    Усі вибрані дні та страви збережено у вашому браузері
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => resetWizard()}
                  className="flex-1 sm:flex-none text-xs text-slate-500 hover:text-red-500 underline px-2 py-1 transition-colors"
                >
                  Очистити
                </button>
                {draftDays > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="flex-1 sm:flex-none rounded-xl border border-emerald-600 dark:border-emerald-500 px-3.5 py-2 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/60 transition shadow-sm text-center"
                  >
                    Змінити страви
                  </button>
                )}
                <Link
                  href="/checkout"
                  className="flex-1 sm:flex-none rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition hover:bg-emerald-700 shadow-sm text-center active:scale-95 whitespace-nowrap"
                >
                  Оформити &rarr;
                </Link>
              </div>
            </div>
          )}

          <PackageSelector
            tariffs={tariffs}
            promoMaterials={promoMaterials}
            onSushkaViewChange={setIsSushkaView}
          />

          {hasCartContent && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md">
              <div className="rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 sm:p-4 shadow-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl flex-shrink-0">🛒</span>
                  <div className="text-slate-800 dark:text-slate-100 text-sm font-semibold truncate">
                    {cartLabel}
                  </div>
                </div>
                <Link
                  href="/checkout"
                  className="flex-shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 shadow-sm whitespace-nowrap active:scale-95"
                >
                  Оформити &rarr;
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

          {hasCartContent && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md">
              <div className="rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 sm:p-4 shadow-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl flex-shrink-0">🛒</span>
                  <div className="text-slate-800 dark:text-slate-100 text-sm font-semibold truncate">
                    {cartLabel}
                  </div>
                </div>
                <Link
                  href="/checkout"
                  className="flex-shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 shadow-sm whitespace-nowrap active:scale-95"
                >
                  Оформити &rarr;
                </Link>
              </div>
            </div>
          )}
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
