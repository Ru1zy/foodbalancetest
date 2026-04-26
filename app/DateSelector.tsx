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
    <div className="transition-opacity duration-300 ease-out motion-reduce:transition-none">
      <div className="mb-6 flex items-center justify-center gap-2">
        {([1, 2, 3] as const).map((n) => (
          <div
            key={n}
            className={`h-2 w-8 rounded-full transition-colors ${
              n === 2 ? "bg-blue-600" : n < 2 ? "bg-blue-200" : "bg-gray-200"
            }`}
            aria-hidden
          />
        ))}
      </div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">{title}</h2>
      {children}
    </div>
  );

  if (!pkg) {
    return shell(
      "Оберіть дні доставки",
      <p className="text-sm text-gray-600">Спочатку оберіть тариф (крок 1).</p>,
    );
  }

  return shell(
    "Оберіть дні доставки",
    <>
      <p className="mb-2 text-center text-sm text-gray-600">
        Доступні лише дні поточного тижня меню, для яких ще не минув дедлайн (
        <span className="font-medium text-gray-800">понеділок: {menuWeekMondayLabel}</span>
        {NEXT_WEEK_OPEN ? ", замовлення на наступний тиждень" : ""}).
      </p>
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {selectableDays.map((dow) => {
          const key = String(dow);
          const on = selectedDates.includes(key);
          return (
            <button
              key={dow}
              type="button"
              onClick={() => toggleDay(dow)}
              className={`rounded-2xl border-2 px-4 py-4 text-center text-sm font-semibold transition ${
                on
                  ? "border-blue-500 bg-blue-50 text-blue-900"
                  : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
              }`}
            >
              {dayNames[dow] ?? `День ${dow}`}
            </button>
          );
        })}
      </div>
      <div className="mt-8 flex flex-col-reverse items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
        >
          Назад
        </button>
        <button
          type="button"
          disabled={selectedDates.length === 0}
          onClick={() => setStep(3)}
          className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
            selectedDates.length > 0
              ? "bg-gray-900 text-white hover:bg-blue-600"
              : "cursor-not-allowed bg-gray-200 text-gray-400"
          }`}
        >
          Далі
        </button>
      </div>
    </>,
  );
}
