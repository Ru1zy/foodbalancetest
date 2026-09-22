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
  const clearSelections = useOrderStore((s) => s.clearSelections);
  const setStep = useOrderStore((s) => s.setStep);
  const [isSushkaView, setIsSushkaView] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const unsubHydrate = useOrderStore.persist.onHydrate(() => setHasHydrated(false));
    const unsubFinish = useOrderStore.persist.onFinishHydration(() => setHasHydrated(true));
    setHasHydrated(useOrderStore.persist.hasHydrated());
    return () => {
      unsubHydrate();
      unsubFinish();
    };
  }, []);

  const { draftDays, draftComplete, canCheckout, totalDaysCount, totalPackagesCount, hasCartContent, cartLabel } = useMemo(() => {
    if (!hasHydrated) {
      return {
        draftDays: 0,
        draftComplete: false,
        canCheckout: false,
        totalDaysCount: 0,
        totalPackagesCount: 0,
        hasCartContent: false,
        cartLabel: "",
      };
    }

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

    // Draft is complete only when ALL selected days have been fully assembled
    const isDraftComplete = selectedDates.length > 0 && draft === selectedDates.length;
    // Can checkout: either the draft is complete, or there are already added packages in cart
    const canProceed = (addedCartPackages > 0 || isDraftComplete) && (totalDays > 0 || totalPackages > 0);

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
      draftComplete: isDraftComplete,
      canCheckout: canProceed,
      totalDaysCount: totalDays,
      totalPackagesCount: totalPackages,
      hasCartContent: totalDays > 0 || totalPackages > 0,
      cartLabel: label,
    };
  }, [hasHydrated, cartItems, selectedPackageRaw, selectedDates, selections]);

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

  const renderStepper = () => {
    const stepsList = [
      { num: 1, label: "Тарифи", shortLabel: "Тарифи", icon: "🥗" },
      { num: 2, label: "Дні доставки", shortLabel: "Дні", icon: "📅" },
      { num: 3, label: "Меню та страви", shortLabel: "Меню", icon: "🍽️" },
    ];

    return (
      <nav aria-label="Кроки замовлення" className="w-full max-w-xl mx-auto my-2 px-1 sm:px-0">
        <div className="flex items-center justify-between p-1 sm:p-1.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-sm backdrop-blur-md gap-1 sm:gap-1.5">
          {stepsList.map((s) => {
            const isActive = step === s.num;
            const isConfigured =
              s.num === 1
                ? Boolean(selectedPackageRaw)
                : s.num === 2
                ? selectedDates.length > 0
                : Boolean(draftDays > 0 && draftDays === selectedDates.length);

            const canNavigate =
              s.num === 1
                ? true
                : s.num === 2
                ? Boolean(selectedPackageRaw)
                : Boolean(selectedPackageRaw && selectedDates.length > 0);

            return (
              <button
                key={s.num}
                type="button"
                disabled={!canNavigate}
                onClick={() => {
                  if (canNavigate) {
                    setStep(s.num as 1 | 2 | 3);
                  }
                }}
                className={`min-w-0 flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1.5 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
                  isActive
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-600/20 cursor-default"
                    : canNavigate
                    ? isConfigured
                      ? "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer"
                    : "text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-40 select-none"
                }`}
              >
                <span className="text-xs sm:text-base flex-shrink-0">
                  {isConfigured && !isActive ? "✓" : s.icon}
                </span>
                <span className="sm:hidden text-xs font-bold truncate">{s.shortLabel}</span>
                <span className="hidden sm:inline truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  };

  const renderFloatingCart = () => {
    if (!hasCartContent) return null;
    const remaining = selectedDates.length - draftDays;
    const subtitle =
      draftDays > 0 && !draftComplete
        ? `Залишилось зібрати: ${remaining} ${remaining === 1 ? "день" : remaining >= 5 ? "днів" : "дні"}`
        : canCheckout
        ? "Збережено у вашому кошику"
        : `Залишилось зібрати: ${remaining} ${remaining === 1 ? "день" : remaining >= 5 ? "днів" : "дні"}`;

    return (
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.5rem)] max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
        <div className="rounded-2xl border border-emerald-400/40 dark:border-emerald-500/30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-2.5 sm:p-4 shadow-2xl shadow-emerald-950/20 flex items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-base sm:text-lg flex-shrink-0">
              🛒
            </div>
            <div className="min-w-0">
              <div className="text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-bold truncate">
                {cartLabel}
              </div>
              <div
                className={`text-[10px] font-semibold truncate ${
                  canCheckout ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {subtitle}
              </div>
            </div>
          </div>
          {canCheckout ? (
            <Link
              href="/checkout"
              className="flex-shrink-0 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-black text-white transition-all shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/40 whitespace-nowrap active:scale-95 flex items-center gap-1"
            >
              <span>Оформити</span>
              <span className="text-sm sm:text-base leading-none">→</span>
            </Link>
          ) : (
            <span className="flex-shrink-0 rounded-xl bg-slate-200 dark:bg-slate-800 px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-black text-slate-400 dark:text-slate-600 whitespace-nowrap cursor-not-allowed flex items-center gap-1">
              <span>Оформити</span>
              <span className="text-sm sm:text-base leading-none">→</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  switch (step) {
    case 1:
      return (
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center gap-6 px-4 sm:px-6 md:px-8">
          {/* Hero Section - Visible only on Step 1 when NOT in Sushka Light program presentation */}
          {!isSushkaView && (
            <>
              <div className="mb-4 text-center relative w-full flex flex-col items-center">
                {/* Brand Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/20 dark:border-emerald-400/20 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-bold mb-4 backdrop-blur-sm shadow-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Свіже ресторанне харчування щоранку</span>
                </div>

                <div className="mb-3 flex justify-center">
                  <img
                    src="/foodbalancelogo.png"
                    alt="Food Balance — Доставка здорового харчування та раціонів"
                    className="h-28 w-28 sm:h-32 sm:w-32 object-contain drop-shadow-md transition-transform duration-300 hover:scale-105"
                  />
                </div>

                <h1 className="mb-4 text-4xl sm:text-5xl md:text-6xl font-black leading-tight tracking-tighter drop-shadow-md">
                  <span className="bg-gradient-to-b from-emerald-400 to-emerald-600 bg-clip-text text-transparent">Food</span> <span className="bg-gradient-to-b from-orange-400 to-orange-600 bg-clip-text text-transparent">Balance</span>
                  <span className="sr-only"> — Доставка здорового харчування та готових раціонів</span>
                </h1>

                <p className="text-lg sm:text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Здорове харчування з доставкою до дверей
                </p>

                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-8">
                  Оберіть готовий раціон під власну ціль або складіть індивідуальне меню зі щоденним підрахунком КБЖВ
                </p>

                {/* Bento Stats */}
                <div className="mb-8 grid grid-cols-3 gap-2 sm:gap-4 max-w-2xl mx-auto w-full">
                  <div className="rounded-2xl p-2.5 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md text-center shadow-sm hover:border-emerald-400/40 transition-all duration-300">
                    <div className="text-xl sm:text-3xl md:text-4xl font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap tracking-tight">
                      1 000+
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Клієнтів на місяць</div>
                  </div>
                  <div className="rounded-2xl p-2.5 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md text-center shadow-sm hover:border-orange-400/40 transition-all duration-300">
                    <div className="text-xl sm:text-3xl md:text-4xl font-black text-orange-600 dark:text-orange-400 whitespace-nowrap tracking-tight">
                      75 000+
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Доставлених страв</div>
                  </div>
                  <div className="rounded-2xl p-2.5 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md text-center shadow-sm hover:border-emerald-400/40 transition-all duration-300">
                    <div className="text-xl sm:text-3xl md:text-4xl font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap tracking-tight">
                      100%
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Свіжі продукти</div>
                  </div>
                </div>
              </div>

              {renderStepper()}
            </>
          )}

          {hasCartContent && (
            <div className="w-full rounded-2xl border border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/90 dark:bg-emerald-950/70 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300 backdrop-blur-sm">
              <div className="flex items-center gap-3.5">
                <span className="text-3xl sm:text-4xl select-none">🛒</span>
                <div>
                  <div className="font-bold text-emerald-950 dark:text-emerald-100 text-base sm:text-lg">
                    {cartItems.length > 0 && draftDays > 0 ? (
                      <>
                        У вашому кошику: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{totalPackagesCount} раціони</span> ({totalDaysCount} дн.)
                      </>
                    ) : draftDays > 0 && selectedPackageRaw ? (
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
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    clearSelections();
                    resetWizard();
                  }}
                  className="text-xs text-slate-500 hover:text-red-500 underline px-2 py-1 transition-colors mr-auto sm:mr-0"
                >
                  Очистити
                </button>
                {draftDays > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="flex-1 sm:flex-none rounded-xl border border-emerald-600 dark:border-emerald-500 px-3 py-2 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/60 transition shadow-sm text-center whitespace-nowrap"
                  >
                    Змінити страви
                  </button>
                )}
                {canCheckout ? (
                  <Link
                    href="/checkout"
                    className="flex-1 sm:flex-none rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-white transition shadow-sm text-center active:scale-95 whitespace-nowrap"
                  >
                    Оформити &rarr;
                  </Link>
                ) : (
                  <span className="flex-1 sm:flex-none rounded-xl bg-slate-300 dark:bg-slate-800 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-600 text-center cursor-not-allowed whitespace-nowrap">
                    Оформити &rarr;
                  </span>
                )}
              </div>
            </div>
          )}

          <PackageSelector
            tariffs={tariffs}
            promoMaterials={promoMaterials}
            onSushkaViewChange={setIsSushkaView}
          />

          {renderFloatingCart()}
        </div>
      );
    case 2:
      return (
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center gap-6 px-4 sm:px-6 md:px-8">
          {renderStepper()}
          <DateSelector menuItems={menuItems} orderingMode={orderingMode} tariffs={tariffs} />
          {renderFloatingCart()}
        </div>
      );
    case 3:
      return (
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center text-center gap-6 px-4 sm:px-6 md:px-8">
          {renderStepper()}
          <MenuGridClient menuItems={menuItems} orderingMode={orderingMode} />
          {renderFloatingCart()}
        </div>
      );
    default:
      return <PackageSelector tariffs={tariffs} promoMaterials={promoMaterials} />;
  }
}
