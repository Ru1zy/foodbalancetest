"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import type { MenuItem } from "@/lib/menu-types";
import { getMenuRowIdsForPackageDay } from "@/lib/menu-for-package";
import {
  getMenuWeekMonday,
  getSelectableMenuDayNumbers,
  NEXT_WEEK_OPEN,
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

type Props = {
  menuItems: MenuItem[];
};

export default function DateSelector({ menuItems }: Props) {
  const selectedPackage = useOrderStore((s) => s.selectedPackage);
  const selectedDates = useOrderStore((s) => s.selectedDates);
  const setStep = useOrderStore((s) => s.setStep);
  const setSelectedDates = useOrderStore((s) => s.setSelectedDates);
  const clearDaySelections = useOrderStore((s) => s.clearDaySelections);

  /** Same menu-week anchor as `isDaySelectable` / deadlines: `getTargetMonday` + `NEXT_WEEK_OPEN`. */
  const menuWeekMondayLabel = useMemo(() => {
    const monday = getMenuWeekMonday();
    return new Intl.DateTimeFormat("uk-UA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Kyiv",
    }).format(monday);
  }, []);

  const selectableDays = getSelectableMenuDayNumbers();
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
      <h2 className="mb-6 text-3xl font-black text-gray-900 dark:text-slate-100 text-center">{title}</h2>
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
      <p className="mb-8 text-center text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
        Доступні лише дні поточного тижня меню, для яких ще не минув дедлайн (
        <span className="font-semibold text-gray-900 dark:text-slate-100">{menuWeekMondayLabel}</span>
        {NEXT_WEEK_OPEN ? ", замовлення на наступний тиждень" : ""}).
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
    </>,
  );
}
