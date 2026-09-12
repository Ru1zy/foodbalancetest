"use client";

import { Flame, Plus, Minus, Info } from "lucide-react";
import {
  SPORT_BASE_KCAL,
  SPORT_EXTRA_PRICE_PER_100_KCAL,
  SPORT_MAX_EXTRA_CLICKS,
  SPORT_MAX_KCAL,
} from "@/lib/order-logic";

type Props = {
  packageType: string;
  extraKcal: number;
  onChangeExtraKcal: (newKcal: number) => void;
  dayCount?: number;
  readOnly?: boolean;
};

/**
 * Modular Add-ons component for cart items.
 * Currently supports Sport Active+ calorie increments (+100 kcal = +35 UAH/day, up to 10 clicks / 3400 kcal).
 * Architected to be easily extensible with other modifiers (cutlery, smoothies, gluten-free, snacks).
 */
export default function CartItemAddons({
  packageType,
  extraKcal,
  onChangeExtraKcal,
  dayCount = 1,
  readOnly = false,
}: Props) {
  const isSport = packageType.toLowerCase().includes("sport");

  // Only Sport Active+ has calorie add-ons
  if (!isSport) {
    return null;
  }

  const currentExtra = Math.min(Math.max(0, extraKcal || 0), SPORT_MAX_EXTRA_CLICKS * 100);
  const currentTotalKcal = SPORT_BASE_KCAL + currentExtra;
  const clicks = Math.round(currentExtra / 100);
  const dailyExtraPrice = clicks * SPORT_EXTRA_PRICE_PER_100_KCAL;
  const periodExtraPrice = dailyExtraPrice * Math.max(1, dayCount);
  const isMax = clicks >= SPORT_MAX_EXTRA_CLICKS;
  const isMin = clicks <= 0;

  const handleDecrement = () => {
    if (readOnly || isMin) return;
    onChangeExtraKcal(Math.max(0, currentExtra - 100));
  };

  const handleIncrement = () => {
    if (readOnly || isMax) return;
    onChangeExtraKcal(Math.min(SPORT_MAX_EXTRA_CLICKS * 100, currentExtra + 100));
  };

  return (
    <div className="mt-3.5 rounded-xl border border-orange-200/80 dark:border-orange-900/50 bg-gradient-to-br from-orange-50/70 to-amber-50/40 dark:from-orange-950/20 dark:to-amber-950/10 p-3 sm:p-3.5 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 font-bold text-orange-900 dark:text-orange-200">
          <Flame className="w-4 h-4 text-orange-500 shrink-0" />
          <span>Калораж раціону</span>
        </div>
        <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300/80 bg-orange-100/80 dark:bg-orange-900/40 px-2 py-0.5 rounded-md">
          +{SPORT_EXTRA_PRICE_PER_100_KCAL} ₴ / 100 ккал / день
        </span>
      </div>

      {/* Interactive Counter Row */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900/90 rounded-lg p-2 border border-orange-100 dark:border-slate-800 shadow-2xs">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={readOnly || isMin}
          aria-label="Зменшити калораж"
          className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-950 dark:hover:text-orange-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <div className="text-center flex-1">
          <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
            <span>{currentTotalKcal} ккал</span>
            {clicks > 0 && (
              <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                (+{clicks * 100} ккал)
              </span>
            )}
          </div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {clicks === 0 ? (
              <span>Базовий (без доплати)</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                +{dailyExtraPrice} ₴/день
                {dayCount > 1 ? ` (+${periodExtraPrice} ₴ за ${dayCount} дн.)` : ""}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={readOnly || isMax}
          aria-label="Збільшити калораж"
          className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-950 dark:hover:text-orange-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Helper text on max limit */}
      {isMax && (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300/90 bg-amber-100/60 dark:bg-amber-950/40 p-2 rounded-lg">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>
            Максимум для стандартного меню ({SPORT_MAX_KCAL} ккал). Якщо вам потрібен ще більший
            калораж — оберіть тариф <b>«Індивідуальний»</b> або повідомте менеджеру.
          </span>
        </div>
      )}
    </div>
  );
}
