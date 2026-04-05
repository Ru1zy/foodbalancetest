"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { getPackageLimit, isDaySelectable, mealSuffix, PackageType } from "../lib/order-logic";
import {
  buildIndivDishId,
  getDaySelectedCount,
  isIndivPackage,
} from "@/lib/order-selection";
import { useOrderStore } from "@/lib/orderStore";

// Типизация для конкретного варианта блюда
export type DishOption = {
  full: string;
  short: string;
};

// Структура JSON поля dishes в базе
export type Dishes = {
  breakfast: DishOption[];
  lunch: DishOption[];
  dinner: DishOption[];
  snack?: DishOption[];
  extra?: DishOption[];
};

export type MenuItem = {
  id: string;
  dayOfWeek: number;
  packageType: string;
  dishes: Dishes;
};

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

const PACKAGES: PackageType[] = ["Slim", "Balance", "Active", "Sport", "Sushka", "Indiv"];

const normalizeDish = (dish: DishOption, suffix = "") => ({
  full: suffix ? `${dish.full}${suffix}` : dish.full,
  short: suffix ? `${dish.short}${suffix}` : dish.short,
});

const transformMenuForPackage = (item: MenuItem, packageType: PackageType): MenuItem => {
  if (packageType === "Sushka") {
    return item;
  }

  if (item.packageType !== "Template") {
    return item;
  }

  const lunchSuffix = mealSuffix(packageType, "lunch");
  const dinnerSuffix = mealSuffix(packageType, "dinner");

  const breakfast = (item.dishes.breakfast || []).map((dish) => normalizeDish(dish, ""));
  const lunch = (item.dishes.lunch || []).map((dish) => normalizeDish(dish, lunchSuffix));
  const dinner = (item.dishes.dinner || []).map((dish) => normalizeDish(dish, dinnerSuffix));
  const snack = packageType === "Slim" ? [] : (item.dishes.snack || []).map((dish) => normalizeDish(dish, ""));
  const extra = packageType === "Sport" ? [...breakfast, ...lunch, ...dinner, ...snack] : undefined;

  return {
    ...item,
    dishes: { breakfast, lunch, dinner, snack, extra },
  };
};

export default function MenuGridClient({ menuItems }: Props) {
  const router = useRouter();
  const selectedPackage = useOrderStore((state) => state.selectedPackage);
  const selections = useOrderStore((state) => state.selections);
  const incrementDish = useOrderStore((state) => state.incrementDish);
  const decrementDish = useOrderStore((state) => state.decrementDish);
  const setPackage = useOrderStore((state) => state.setPackage);
  const setSelection = useOrderStore((state) => state.setSelection);
  const indivSelected = isIndivPackage(selectedPackage);

  const templates = useMemo(() => menuItems.filter((item) => item.packageType === "Template"), [menuItems]);
  const sushka = useMemo(() => menuItems.filter((item) => item.packageType === "Sushka"), [menuItems]);

  const filtered = useMemo(() => {
    const source = selectedPackage === "Sushka" ? sushka : templates;
    return source
      .map((item) => transformMenuForPackage(item, selectedPackage))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }, [templates, sushka, selectedPackage]);

  const packageLimit = getPackageLimit(selectedPackage);
  const sorted = filtered;
  const { progressByDay, completedDaysCount } = useMemo(() => {
    const progress: Record<string, { selectedCount: number; isComplete: boolean }> = {};
    let completed = 0;

    for (const item of sorted) {
      const daySelections = selections[item.id] ?? {};
      const selectedCount = getDaySelectedCount(daySelections, selectedPackage);
      const isComplete = selectedCount === packageLimit;

      progress[item.id] = { selectedCount, isComplete };

      if (isComplete) {
        completed += 1;
      }
    }

    return { progressByDay: progress, completedDaysCount: completed };
  }, [packageLimit, selectedPackage, selections, sorted]);

  const allClosed = [1, 2, 3, 4, 5, 6, 7].every((day) => !isDaySelectable(day));

  if (!menuItems || menuItems.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
        <p className="text-gray-500">Меню завантажується або порожнє...</p>
      </div>
    );
  }

  if (allClosed) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm font-semibold text-yellow-800">
          ⚠️ Наразі замовлення закриті. Меню на наступний тиждень публікується в суботу о 12:00 (приблизно). У п`&apos;`ятницю замовлення не приймаються.
        </div>
      </div>
    );
  }

  // Хелпер для рендеру секції прийому їжі
  const MealSection = ({
    itemId,
    category,
    title,
    options,
    disabled,
  }: {
    itemId: string;
    category: keyof Dishes;
    title: string;
    options?: DishOption[];
    disabled: boolean;
  }) => {
    if (!options || options.length === 0) return null;

    const isIndiv = indivSelected;
    const selectedIndex = selections[itemId]?.[category];
    const daySelectedCount = progressByDay[itemId]?.selectedCount ?? 0;

    return (
      <div className="mb-4 last:mb-0">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-blue-500">
          {title}
        </div>
        <div className="space-y-2">
          {options.map((opt, idx) => {
            if (isIndiv) {
              const dishId = buildIndivDishId(category, idx);
              const quantity = selections[itemId]?.[dishId] ?? 0;
              const isAtLimit = daySelectedCount >= packageLimit;

              return (
                <div
                  key={dishId}
                  className={`rounded-lg border p-3 text-left text-sm transition ${
                    quantity > 0
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white"
                  } ${disabled ? "opacity-50" : ""}`}
                >
                  <div className="font-medium text-gray-800">{opt.full}</div>
                  {opt.short && opt.short !== opt.full && (
                    <div className="text-xs text-gray-500">{opt.short}</div>
                  )}
                  {options.length > 1 && (
                    <div className="mt-1 text-[9px] text-blue-500">ВАРІАНТ {idx + 1}</div>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-gray-500">
                      Обрано: {quantity}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={disabled || quantity === 0}
                        onClick={() => {
                          if (disabled || quantity === 0) return;
                          decrementDish(itemId, dishId);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-base font-bold text-gray-700 transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        -
                      </button>
                      <div className="min-w-8 text-center text-sm font-bold text-gray-900">{quantity}</div>
                      <button
                        type="button"
                        disabled={disabled || isAtLimit}
                        onClick={() => {
                          if (disabled || isAtLimit) return;
                          incrementDish(itemId, dishId);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-white text-base font-bold text-blue-600 transition hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            const isSelected = selectedIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  setSelection(itemId, category as string, idx);
                }}
                className={`w-full rounded-lg border p-2 text-left text-sm transition ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 font-bold"
                    : "border-gray-200 bg-white hover:border-blue-200"
                } ${disabled ? "pointer-events-none opacity-50" : ""}`}
              >
                <div className="font-medium text-gray-800">{opt.full}</div>
                {opt.short && opt.short !== opt.full && (
                  <div className="text-xs text-gray-500">{opt.short}</div>
                )}
                {options.length > 1 && (
                  <div className="mt-1 text-[9px] text-blue-500">ВАРІАНТ {idx + 1}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="mx-auto max-w-7xl p-4 pb-32 sm:p-6 sm:pb-36">
        {/* Перемикач пакету */}
        <div className="mb-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="inline-flex rounded-xl bg-gray-100 p-1 shadow-inner">
            {PACKAGES.map((type) => (
              <button
                key={type}
                onClick={() => setPackage(type)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                  selectedPackage === type
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {type === "Indiv" ? "INDIV" : type}
              </button>
            ))}
          </div>
        </div>

        {/* Сітка карток */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((item) => {
            const day = dayNames[item.dayOfWeek] || `День ${item.dayOfWeek}`;
            const { dishes } = item;
            const selectable = isDaySelectable(item.dayOfWeek);
            const dayProgress = progressByDay[item.id] ?? { selectedCount: 0, isComplete: false };

            return (
              <div
                key={item.id}
                className={`group flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 transition-all ${
                  selectable ? "hover:shadow-md hover:ring-blue-200" : "opacity-50"
                }`}
              >
                <div className="mb-4 flex items-center justify-between border-b border-gray-50 pb-3">
                  <h3 className="text-xl font-bold text-gray-900">{day}</h3>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-500 uppercase">
                    {selectedPackage}
                  </span>
                </div>
                {!selectable && (
                  <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                    Вибір цього дня закритий за дедлайном
                  </div>
                )}
                {indivSelected && (
                  <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                    Для Indiv обирайте будь-які страви та вказуйте кількість до {packageLimit} на день.
                  </div>
                )}

                <div className="flex-grow">
                  <MealSection itemId={item.id} category="breakfast" title="Сніданок" options={dishes.breakfast} disabled={!selectable} />
                  <MealSection itemId={item.id} category="lunch" title="Обід" options={dishes.lunch} disabled={!selectable} />
                  <MealSection itemId={item.id} category="dinner" title="Вечеря" options={dishes.dinner} disabled={!selectable} />
                  <MealSection itemId={item.id} category="snack" title="Перекус" options={dishes.snack} disabled={!selectable} />
                  <MealSection itemId={item.id} category="extra" title="Додаткова страва (Sport)" options={dishes.extra} disabled={!selectable} />
                </div>

                {/* Футер картки */}
                <div className="mt-4 border-t border-gray-50 pt-3">
                  {dayProgress.isComplete ? (
                    <p className="text-sm font-semibold text-green-600">День зібрано</p>
                  ) : (
                    <p className="text-sm font-semibold text-gray-600">
                      Зібрано {dayProgress.selectedCount}/{packageLimit}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6">
        <div className="pointer-events-auto mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <p className="text-sm font-semibold text-gray-900">Днів зібрано: {completedDaysCount}</p>
          <button
            type="button"
            disabled={completedDaysCount === 0}
            onClick={() => {
              if (completedDaysCount === 0) return;
              router.push("/checkout");
            }}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              completedDaysCount > 0
                ? "bg-gray-900 text-white hover:bg-blue-600"
                : "cursor-not-allowed bg-gray-200 text-gray-400"
            }`}
          >
            Перейти до оформлення
          </button>
        </div>
      </div>
    </>
  );
}
