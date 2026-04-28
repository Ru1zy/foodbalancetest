"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getPackageLimit, isDaySelectable, type PackageType } from "../lib/order-logic";
import { getMenuRowsForPackage } from "@/lib/menu-for-package";
import type { Dishes, DishOption, MenuItem } from "@/lib/menu-types";
import { parsePackageType } from "@/lib/package-coerce";
import {
  buildIndivDishId,
  getDaySelectedCount,
  isDaySelectionComplete,
  isIndivPackage,
} from "@/lib/order-selection";
import { useOrderStore } from "@/lib/orderStore";
import DishCard from "@/components/DishCard";

export type { DishOption, Dishes, MenuItem } from "@/lib/menu-types";

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

const PACKAGES: PackageType[] = ["Slim", "Balance", "Active", "Sport", "Sushka XS", "Sushka S", "Indiv"];

function buildDishOptionKey(itemId: string, category: keyof Dishes, option: DishOption, index: number) {
  return [itemId, category, option.short || option.full, option.full, index].join("::");
}

type MealSectionProps = {
  itemId: string;
  category: keyof Dishes;
  title: string;
  options?: DishOption[];
  disabled: boolean;
  pkg: PackageType | null;
  isSushka: boolean;
  indivSelected: boolean;
  packageLimit: number;
  selections: Record<string, Record<string, number>>;
  progressByDay: Record<string, { selectedCount: number; isComplete: boolean }>;
  incrementDish: (dayId: string, dishId: string) => void;
  decrementDish: (dayId: string, dishId: string) => void;
  setSelection: (dayId: string, category: string, dishIndex: number) => void;
};

function MealSection({
  itemId,
  category,
  title,
  options,
  disabled,
  pkg,
  isSushka,
  indivSelected,
  packageLimit,
  selections,
  progressByDay,
  incrementDish,
  decrementDish,
  setSelection,
}: MealSectionProps) {
  if (!options || options.length === 0) return null;
  if (!pkg) return null;

  const visibleOptions = isSushka ? options.slice(0, 1) : options;

  if (isSushka) {
    return (
      <div className="mb-4 last:mb-0">
        <div className="mt-6 mb-3 text-lg font-extrabold uppercase tracking-wider text-emerald-600 md:text-xl">
          {title}
        </div>
        <ul className="space-y-1">
          {visibleOptions.map((opt, idx) => (
            <li
              key={buildDishOptionKey(itemId, category, opt, idx)}
              className="break-words text-sm text-gray-700"
            >
              {opt.full}
              {opt.short && opt.short !== opt.full && (
                <span className="text-xs text-gray-500"> ({opt.short})</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const selectedIndex = selections[itemId]?.[category];
  const daySelectedCount = progressByDay[itemId]?.selectedCount ?? 0;

  return (
    <div className="mb-4 last:mb-0">
      <div className="mt-6 mb-3 text-lg font-extrabold uppercase tracking-wider text-emerald-600 md:text-xl">
        {title}
      </div>
      <div className="space-y-2">
        {visibleOptions.map((opt, idx) => {
          if (indivSelected) {
            const dishId = buildIndivDishId(category, idx);
            const quantity = selections[itemId]?.[dishId] ?? 0;
            const isAtLimit = daySelectedCount >= packageLimit;

            return (
              <div
                key={dishId}
                className={`rounded-lg border p-3 text-left text-sm transition ${
                  quantity > 0 ? "border-emerald-500 bg-emerald-50" : "border-gray-200 bg-white"
                } ${disabled ? "opacity-50" : ""}`}
              >
                <div className="break-words font-medium text-gray-800">{opt.full}</div>
                {opt.short && opt.short !== opt.full && (
                  <div className="break-words text-xs text-gray-500">{opt.short}</div>
                )}
                {options.length > 1 && (
                  <div className="mt-1 text-[9px] text-emerald-500">ВАРІАНТ {idx + 1}</div>
                )}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-gray-500">
                    Обрано: {quantity}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={disabled || quantity === 0}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
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
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (disabled || isAtLimit) return;
                        incrementDish(itemId, dishId);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-base font-bold text-emerald-600 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
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
            <DishCard
              key={buildDishOptionKey(itemId, category, opt, idx)}
              dishName={opt.full}
              dishShort={opt.short !== opt.full ? opt.short : undefined}
              variantNumber={options.length > 1 ? idx + 1 : undefined}
              isSelected={isSelected}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                setSelection(itemId, category as string, idx);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function MenuGridClient({ menuItems }: Props) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const step = useOrderStore((state) => state.step);
  const selectedPackageRaw = useOrderStore((state) => state.selectedPackage);
  const selectedDatesFromStore = useOrderStore((state) => state.selectedDates);
  const setStep = useOrderStore((state) => state.setStep);
  const selections = useOrderStore((state) => state.selections);
  const incrementDish = useOrderStore((state) => state.incrementDish);
  const decrementDish = useOrderStore((state) => state.decrementDish);
  const setPackage = useOrderStore((state) => state.setPackage);
  const setSelection = useOrderStore((state) => state.setSelection);

  const pkg = parsePackageType(selectedPackageRaw);
  const indivSelected = isIndivPackage(selectedPackageRaw ?? undefined);
  const isSushka = pkg?.includes("Sushka") ?? false;

  const filtered = useMemo(() => {
    if (!pkg) {
      return [];
    }
    let rows = getMenuRowsForPackage(menuItems, pkg);
    const wizardFilterActive = step === 3 && selectedDatesFromStore.length > 0;
    if (wizardFilterActive) {
      const allow = new Set(selectedDatesFromStore.map((s) => Number(s)));
      rows = rows.filter((item) => allow.has(item.dayOfWeek));
    }
    return rows;
  }, [menuItems, pkg, selectedDatesFromStore, step]);

  const packageLimit = getPackageLimit(pkg ?? undefined);
  const sorted = filtered;

  const { progressByDay, completedDaysCount, allWizardDaysComplete } = useMemo(() => {
    const progress: Record<string, { selectedCount: number; isComplete: boolean }> = {};
    let completed = 0;

    if (!pkg) {
      return { progressByDay: progress, completedDaysCount: 0, allWizardDaysComplete: false };
    }

    // For Sushka packages, the menu is fixed - auto-complete all days
    if (isSushka) {
      for (const item of sorted) {
        progress[item.id] = { selectedCount: packageLimit, isComplete: true };
        completed += 1;
      }
      return {
        progressByDay: progress,
        completedDaysCount: sorted.length,
        allWizardDaysComplete: sorted.length > 0,
      };
    }

    for (const item of sorted) {
      const daySelections = selections[item.id] ?? {};
      const selectedCount = getDaySelectedCount(daySelections, pkg);

      // For Indiv package, any selection >= 1 is complete
      // For other packages, must match the exact limit
      const isComplete = isDaySelectionComplete(selectedCount, pkg);

      progress[item.id] = { selectedCount, isComplete };

      if (isComplete) {
        completed += 1;
      }
    }

    const wizardFilterActive = step === 3 && selectedDatesFromStore.length > 0;
    const allComplete =
      wizardFilterActive && sorted.length > 0 && completed === sorted.length;

    return {
      progressByDay: progress,
      completedDaysCount: completed,
      allWizardDaysComplete: allComplete,
    };
  }, [packageLimit, pkg, selections, selectedDatesFromStore.length, sorted, step, isSushka]);

  const allClosed = [1, 2, 3, 4, 5, 6, 7].every((day) => !isDaySelectable(day));

  const hidePackageSwitcher = step === 3;
  const wizardFilterActive = step === 3 && selectedDatesFromStore.length > 0;

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
          ⚠️ Наразі замовлення закриті. Меню на наступний тиждень публікується в суботу о 12:00 (приблизно). У
          п&apos;ятницю замовлення не приймаються.
        </div>
      </div>
    );
  }

  if (step === 3 && !pkg) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-900">
        Тариф не обрано. Поверніться на перший крок майстра замовлення.
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            До вибору тарифу
          </button>
        </div>
      </div>
    );
  }

  const canProceedToCheckout = wizardFilterActive ? allWizardDaysComplete : completedDaysCount > 0;

  return (
    <>
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 pb-48 md:pb-64">
        {step === 3 && (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm font-semibold text-emerald-600 transition hover:text-emerald-800"
            >
              ← Назад до вибору днів
            </button>
          </div>
        )}

        {!hidePackageSwitcher && (
          <div className="mb-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap justify-center gap-1 rounded-xl bg-gray-100 p-1 shadow-inner">
              {PACKAGES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPackage(type)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                    selectedPackageRaw === type
                      ? "bg-white text-emerald-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {type === "Indiv" ? "INDIV" : type}
                </button>
              ))}
            </div>
          </div>
        )}

        {sorted.length === 0 && wizardFilterActive ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-600">
            Для обраного тарифу немає карток меню на вибрані дні. Поверніться назад і змініть набір днів або тариф.
          </div>
        ) : (
          <div className="flex flex-wrap justify-center items-start gap-6 w-full max-w-6xl mx-auto">
            {sorted.map((item) => {
              const day = dayNames[item.dayOfWeek] || `День ${item.dayOfWeek}`;
              const { dishes } = item;
              const selectable = isDaySelectable(item.dayOfWeek);
              const dayProgress = progressByDay[item.id] ?? { selectedCount: 0, isComplete: false };

              return (
                <div
                  key={item.id}
                  className={`w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] max-w-md group flex flex-col bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.1)] active:scale-[0.99] ${
                    selectable ? "hover:shadow-md" : "opacity-50"
                  }`}
                >
                  {item.photoUrl && (
                    <div
                      className="relative h-48 w-full overflow-hidden bg-gray-100 cursor-pointer"
                      onClick={() => setZoomedImage(item.photoUrl || null)}
                    >
                      <img
                        src={item.photoUrl}
                        alt={`${day} menu`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4 sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 pb-3">
                      <h3 className="break-words text-lg font-bold text-gray-900 sm:text-xl">{day}</h3>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase text-gray-500">
                        {selectedPackageRaw ?? "—"}
                      </span>
                    </div>
                  {!selectable && (
                    <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                      Вибір цього дня закритий за дедлайном
                    </div>
                  )}
                  {indivSelected && (
                    <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                      Для Indiv обирайте будь-які страви від 1 до {packageLimit} на день.
                    </div>
                  )}

                  <div className="flex-grow">
                    <MealSection
                      itemId={item.id}
                      category="breakfast"
                      title="Сніданок"
                      options={dishes.breakfast}
                      disabled={!selectable}
                      pkg={pkg}
                      isSushka={isSushka}
                      indivSelected={indivSelected}
                      packageLimit={packageLimit}
                      selections={selections}
                      progressByDay={progressByDay}
                      incrementDish={incrementDish}
                      decrementDish={decrementDish}
                      setSelection={setSelection}
                    />
                    <MealSection
                      itemId={item.id}
                      category="lunch"
                      title="Обід"
                      options={dishes.lunch}
                      disabled={!selectable}
                      pkg={pkg}
                      isSushka={isSushka}
                      indivSelected={indivSelected}
                      packageLimit={packageLimit}
                      selections={selections}
                      progressByDay={progressByDay}
                      incrementDish={incrementDish}
                      decrementDish={decrementDish}
                      setSelection={setSelection}
                    />
                    <MealSection
                      itemId={item.id}
                      category="dinner"
                      title="Вечеря"
                      options={dishes.dinner}
                      disabled={!selectable}
                      pkg={pkg}
                      isSushka={isSushka}
                      indivSelected={indivSelected}
                      packageLimit={packageLimit}
                      selections={selections}
                      progressByDay={progressByDay}
                      incrementDish={incrementDish}
                      decrementDish={decrementDish}
                      setSelection={setSelection}
                    />
                    {!(isSushka && pkg === "Sushka XS") && (
                      <MealSection
                        itemId={item.id}
                        category="snack"
                        title="Перекус"
                        options={dishes.snack}
                        disabled={!selectable}
                        pkg={pkg}
                        isSushka={isSushka}
                        indivSelected={indivSelected}
                        packageLimit={packageLimit}
                        selections={selections}
                        progressByDay={progressByDay}
                        incrementDish={incrementDish}
                        decrementDish={decrementDish}
                        setSelection={setSelection}
                      />
                    )}
                    <MealSection
                      itemId={item.id}
                      category="extra"
                      title="Додаткова страва (Sport)"
                      options={dishes.extra}
                      disabled={!selectable}
                      pkg={pkg}
                      isSushka={isSushka}
                      indivSelected={indivSelected}
                      packageLimit={packageLimit}
                      selections={selections}
                      progressByDay={progressByDay}
                      incrementDish={incrementDish}
                      decrementDish={decrementDish}
                      setSelection={setSelection}
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    {dayProgress.isComplete ? (
                      <p className="text-sm font-semibold text-emerald-600">День зібрано ✓</p>
                    ) : (
                      <p className="text-sm font-semibold text-gray-600">
                        Обрано {dayProgress.selectedCount} з {packageLimit}
                      </p>
                    )}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {zoomedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <img
            src={zoomedImage}
            alt="Day menu details"
            className="max-w-full max-h-full object-contain rounded-lg border border-gray-200"
          />
          <button
            className="absolute top-6 right-6 text-gray-100 text-4xl leading-none hover:text-gray-300"
            onClick={(e) => {
              e.stopPropagation();
              setZoomedImage(null);
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Bulletproof Sticky Checkout Button - Native Browser Behavior */}
      <div className="sticky bottom-4 left-0 right-0 z-[99999] pointer-events-none p-4 mt-auto flex justify-center">
        <div className="pointer-events-auto w-full max-w-md bg-white/95 backdrop-blur shadow-[0_-8px_30px_rgba(0,0,0,0.1)] rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-200">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 shrink-0 text-center sm:text-left">
            <div className="text-sm md:text-base font-semibold text-slate-700">
              Обрано днів: <span className="text-emerald-600 font-bold">{completedDaysCount}</span>
            </div>
          </div>
          <Link
            href={canProceedToCheckout ? "/checkout" : "#"}
            onClick={(e) => !canProceedToCheckout && e.preventDefault()}
            className={`w-full sm:w-auto text-center text-sm md:text-base font-bold py-3.5 px-8 rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap ${
              canProceedToCheckout 
                ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg" 
                : "bg-gray-100 text-gray-400 opacity-60 cursor-not-allowed"
            }`}
          >
            {canProceedToCheckout ? "Оформити замовлення →" : "Оберіть страви"}
          </Link>
        </div>
      </div>
    </>
  );
}
