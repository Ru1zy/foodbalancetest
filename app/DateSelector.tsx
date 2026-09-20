"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { MenuItem } from "@/lib/menu-types";
import { getMenuRowIdsForPackageDay } from "@/lib/menu-for-package";
import {
  getMenuWeekMonday,
  getSelectableMenuDayNumbers,
  isNextWeekOpen,
} from "@/lib/order-logic";
import { parsePackageType } from "@/lib/package-coerce";
import { useOrderStore } from "@/lib/orderStore";

const dayNames: Record<number, string> = {
  1: "Понеділок",
  2: "Вівторок",
  3: "Середа",
  4: "Четвер",
  5: "П’ятниця",
  6: "Субота",
  7: "Неділя",
};

const RATION_DEFAULT_FLYERS: Record<string, string> = {
  Slim: "/images/rations/slim-prices.jpg",
  Balance: "/images/rations/balance-prices.jpg",
  Active: "/images/rations/active-prices.jpg",
  Sport: "/images/rations/sport-prices.jpg",
  "Sushka XS": "/images/sushka/prices-xs.jpg",
  "Sushka S": "/images/sushka/prices-s.jpg",
  Indiv: "/images/rations/programs-overview.jpg",
};

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
  orderingMode?: "AUTO" | "FORCE_OPEN" | "FORCE_CLOSED";
  tariffs?: Tariff[];
};

export default function DateSelector({ menuItems, orderingMode = "AUTO", tariffs }: Props) {
  const selectedPackage = useOrderStore((s) => s.selectedPackage);
  const selectedDates = useOrderStore((s) => s.selectedDates);
  const setStep = useOrderStore((s) => s.setStep);
  const setSelectedDates = useOrderStore((s) => s.setSelectedDates);
  const clearDaySelections = useOrderStore((s) => s.clearDaySelections);

  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  const isNextOpen = isNextWeekOpen(orderingMode);

  const currentTariff = useMemo(() => {
    if (!selectedPackage || !tariffs) return null;
    return (
      tariffs.find(
        (t) =>
          t.name.toLowerCase() === selectedPackage.toLowerCase() ||
          t.title.toLowerCase() === selectedPackage.toLowerCase(),
      ) || null
    );
  }, [selectedPackage, tariffs]);

  const flyerUrl = useMemo(() => {
    if (currentTariff?.imageUrl) return currentTariff.imageUrl;
    if (selectedPackage && RATION_DEFAULT_FLYERS[selectedPackage]) {
      return RATION_DEFAULT_FLYERS[selectedPackage];
    }
    return null;
  }, [currentTariff, selectedPackage]);

  /** Same menu-week anchor as `isDaySelectable` / deadlines: `getTargetMonday` + `orderingMode`. */
  const menuWeekMondayLabel = useMemo(() => {
    const monday = getMenuWeekMonday(new Date(), orderingMode);
    return new Intl.DateTimeFormat("uk-UA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Kyiv",
    }).format(monday);
  }, [orderingMode]);

  const selectableDays = getSelectableMenuDayNumbers(orderingMode);
  const pkg = parsePackageType(selectedPackage);

  const toggleDay = useCallback(
    (dow: number) => {
      const key = String(dow);
      const isOn = selectedDates.includes(key);
      if (!pkg) {
        return;
      }
      if (isOn) {
        const ids = getMenuRowIdsForPackageDay(menuItems, pkg, dow);
        ids.forEach((id) => clearDaySelections(id));
        setSelectedDates(selectedDates.filter((d) => d !== key));
      } else {
        setSelectedDates([...selectedDates, key]);
      }
    },
    [clearDaySelections, menuItems, pkg, selectedDates, setSelectedDates],
  );

  const shell = (title: string, children: ReactNode) => (
    <div className="w-full max-w-4xl mx-auto transition-opacity duration-300 ease-out motion-reduce:transition-none">
      <h2 className="mb-4 text-3xl font-black text-gray-900 dark:text-slate-100 text-center">{title}</h2>
      {children}
    </div>
  );

  if (!pkg) {
    return shell(
      "Оберіть дні доставки",
      <p className="text-center text-gray-500 dark:text-slate-400">Спочатку оберіть тариф (крок 1).</p>,
    );
  }

  return shell(
    "Оберіть дні доставки",
    <>
      {/* Selected package pill & flyer zoom button */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-4 py-2 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-300 shadow-sm backdrop-blur-sm">
          <span>🥗</span>
          <span>Раціон: <strong>{currentTariff?.title || selectedPackage}</strong></span>
          {currentTariff?.kcal && (
            <span className="opacity-80 font-medium hidden sm:inline">• {currentTariff.kcal}</span>
          )}
        </div>

        {flyerUrl && (
          <button
            type="button"
            onClick={() => {
              setZoomScale(1);
              setShowFlyerModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-slate-300 shadow-sm hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition active:scale-95"
          >
            <span>🔍</span>
            <span>Таблиця цін та знижок</span>
          </button>
        )}
      </div>

      {/* Discount threshold callout */}
      <div className="mb-6 max-w-xl mx-auto text-center px-2">
        {selectedDates.length >= 14 ? (
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-black shadow-xs animate-in fade-in duration-200 text-center">
            <span>🎉</span>
            <span>Застосовано знижку 10% (від 14 днів)</span>
          </div>
        ) : selectedDates.length >= 7 ? (
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-black shadow-xs animate-in fade-in duration-200 text-center">
            <span>🎉</span>
            <span className="sm:hidden">Знижка 5%! Ще {14 - selectedDates.length} дн. до 10%</span>
            <span className="hidden sm:inline">Застосовано знижку 5%! Ще {14 - selectedDates.length} дн. до знижки 10%</span>
          </div>
        ) : selectedDates.length >= 5 ? (
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-black shadow-xs animate-in fade-in duration-200 text-center">
            <span>🎉</span>
            <span className="sm:hidden">Знижка 3%! Ще {7 - selectedDates.length} дн. до 5%</span>
            <span className="hidden sm:inline">Застосовано знижку 3%! Ще {7 - selectedDates.length} дн. до знижки 5%</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium text-center">
            <span>💡</span>
            <span>Оберіть від 5 днів для знижки від 3% до 15%</span>
          </div>
        )}
      </div>

      <p className="mb-8 text-center text-sm sm:text-base text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
        Оберіть зручні дні доставки (меню на тиждень:{" "}
        <span className="font-bold text-gray-900 dark:text-slate-100">{menuWeekMondayLabel}</span>
        {isNextOpen ? ", доступне попереднє замовлення на наступний тиждень" : ""}):
      </p>

      <div className="flex flex-wrap justify-center gap-3 sm:gap-4 max-w-4xl mx-auto w-full">
        {selectableDays.map((dow) => {
          const key = String(dow);
          const on = selectedDates.includes(key);
          return (
            <button
              key={dow}
              type="button"
              onClick={() => toggleDay(dow)}
              className={`w-full sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.75rem)] group relative rounded-2xl border-2 p-5 text-left transition-all duration-300 ease-out hover:-translate-y-1 active:scale-[0.98] ${
                on
                  ? "border-emerald-500 dark:border-emerald-400 bg-emerald-50/90 dark:bg-emerald-950/50 shadow-md shadow-emerald-600/10"
                  : "border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 hover:border-emerald-400/50 dark:hover:border-emerald-500/40 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    День {dow}
                  </div>
                  <div className={`text-lg font-black mt-0.5 ${on ? "text-emerald-950 dark:text-emerald-200" : "text-slate-800 dark:text-slate-200"}`}>
                    {dayNames[dow] ?? `День ${dow}`}
                  </div>
                </div>
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                    on
                      ? "bg-emerald-500 text-white shadow-sm scale-105"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-emerald-500"
                  }`}
                >
                  {on ? "✓" : "+"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full px-2">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="w-full sm:w-auto min-w-[140px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 sm:px-8 sm:py-3.5 text-sm sm:text-base font-bold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 shadow-sm text-center"
        >
          ← Змінити тариф
        </button>
        <button
          type="button"
          disabled={selectedDates.length === 0}
          onClick={() => setStep(3)}
          className={`w-full sm:w-auto min-w-[200px] rounded-2xl px-5 py-3 sm:px-8 sm:py-3.5 text-sm sm:text-base font-black transition-all duration-200 ease-out active:scale-95 flex items-center justify-center gap-2 shadow-md ${
            selectedDates.length > 0
              ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-600/20 hover:shadow-emerald-600/40"
              : "cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400"
          }`}
        >
          <span>Далі до меню</span>
          {selectedDates.length > 0 && (
            <span className="text-xs font-extrabold bg-white/20 px-2 py-0.5 rounded-full">
              {selectedDates.length} {selectedDates.length === 1 ? "день" : selectedDates.length >= 5 ? "днів" : "дні"}
            </span>
          )}
          <span>→</span>
        </button>
      </div>

      {/* Lightbox Modal for Flyer in Step 2 */}
      {showFlyerModal && flyerUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setShowFlyerModal(false)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden rounded-2xl max-h-[80vh] flex items-center justify-center">
              <img
                src={flyerUrl}
                alt="Таблиця цін та знижок"
                style={{ transform: `scale(${zoomScale})` }}
                className="max-h-[80vh] w-auto object-contain rounded-xl shadow-2xl transition-transform duration-200 cursor-zoom-in"
                onClick={() => setZoomScale((s) => (s >= 2 ? 1 : +(s + 0.5).toFixed(1)))}
              />
            </div>

            {/* Zoom Controls */}
            <div className="mt-4 flex items-center gap-2 bg-slate-900/90 border border-white/20 rounded-full px-4 py-1.5 backdrop-blur-md shadow-lg">
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.max(1, +(s - 0.5).toFixed(1)))}
                disabled={zoomScale <= 1}
                className="text-white hover:text-emerald-400 p-1 transition-colors disabled:opacity-30"
                title="Віддалити"
              >
                ➖
              </button>
              <span className="text-xs font-bold text-white px-2">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.min(3, +(s + 0.5).toFixed(1)))}
                disabled={zoomScale >= 3}
                className="text-white hover:text-emerald-400 p-1 transition-colors disabled:opacity-30"
                title="Наблизити"
              >
                ➕
              </button>
              {zoomScale > 1 && (
                <button
                  type="button"
                  onClick={() => setZoomScale(1)}
                  className="ml-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50"
                >
                  Скинути
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFlyerModal(false)}
              className="absolute -top-3 -right-3 sm:top-0 sm:right-0 h-10 w-10 flex items-center justify-center rounded-full bg-white/20 text-white text-2xl hover:bg-white/40 transition-colors z-50 backdrop-blur-md border border-white/30"
              title="Закрити"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </>,
  );
}
