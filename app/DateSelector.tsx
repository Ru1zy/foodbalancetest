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
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-4 py-2 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-300 shadow-sm">
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
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-slate-300 shadow-sm hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition active:scale-95"
          >
            <span>🔍</span>
            <span>Таблиця цін та знижок</span>
          </button>
        )}
      </div>

      <p className="mb-8 text-center text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
        Доступні лише дні поточного тижня меню, для яких ще не минув дедлайн (
        <span className="font-semibold text-gray-900 dark:text-slate-100">{menuWeekMondayLabel}</span>
        {isNextOpen ? ", замовлення на наступний тиждень" : ""}).
      </p>

      <div className="flex flex-wrap justify-center gap-3 md:gap-4 max-w-4xl mx-auto w-full">
        {selectableDays.map((dow) => {
          const key = String(dow);
          const on = selectedDates.includes(key);
          return (
            <button
              key={dow}
              type="button"
              onClick={() => toggleDay(dow)}
              className={`w-full sm:w-[calc(50%-0.75rem)] md:w-[calc(33.333%-1rem)] rounded-2xl border-2 px-6 py-5 text-base font-bold transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)] active:scale-95 ${
                on
                  ? "border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-400"
                  : "border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:border-gray-200 dark:border-slate-700"
              }`}
            >
              {dayNames[dow] ?? `День ${dow}`}
            </button>
          );
        })}
      </div>

      <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="w-full sm:w-auto min-w-[140px] rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-8 py-4 text-lg font-bold text-gray-700 dark:text-slate-300 transition hover:bg-gray-50 dark:bg-slate-950 active:scale-95"
        >
          Назад
        </button>
        <button
          type="button"
          disabled={selectedDates.length === 0}
          onClick={() => setStep(3)}
          className={`w-full sm:w-auto min-w-[200px] rounded-xl px-8 py-4 text-lg font-bold transition-all duration-200 ease-out active:scale-95 ${
            selectedDates.length > 0
              ? "bg-gray-900 dark:bg-slate-800 text-white hover:bg-emerald-600 hover:shadow-lg"
              : "cursor-not-allowed bg-gray-200 dark:bg-slate-700 text-gray-400"
          }`}
        >
          Далі
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
