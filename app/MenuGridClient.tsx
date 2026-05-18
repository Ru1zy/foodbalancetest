"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getPackageLimit, isDaySelectable, type PackageType, type PackageLimitInfo } from "../lib/order-logic";
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
  packageLimit: PackageLimitInfo;
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
            const isAtLimit = daySelectedCount >= packageLimit.limit;

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
  const [zoomScale, setZoomScale] = useState(1);

  const step = useOrderStore((state) => state.step);
  const selectedPackageRaw = useOrderStore((state) => state.selectedPackage);
  const selectedDatesFromStore = useOrderStore((state) => state.selectedDates);
  const setStep = useOrderStore((state) => state.setStep);
  const selections = useOrderStore((state) => state.selections);
  const incrementDish = useOrderStore((state) => state.incrementDish);
  const decrementDish = useOrderStore((state) => state.decrementDish);
  const setPackage = useOrderStore((state) => state.setPackage);
  const setSelection = useOrderStore((state) => state.setSelection);
  const isCustomMode = useOrderStore((state) => state.isCustomMode);
  const toggleCustomMode = useOrderStore((state) => state.toggleCustomMode);

  const [activeDayIndex, setActiveDayIndex] = useState(0);

  const pkg = parsePackageType(selectedPackageRaw);
  const isIndiv = isIndivPackage(selectedPackageRaw ?? undefined);
  const indivSelected = isIndiv || isCustomMode;
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
        progress[item.id] = { selectedCount: packageLimit.limit, isComplete: true };
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

  const currentDayItem = sorted[activeDayIndex];
  const isLastDay = activeDayIndex === sorted.length - 1;
  const canProceedToCheckout = wizardFilterActive ? allWizardDaysComplete : completedDaysCount > 0;

  return (
    <>
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 pb-32 md:pb-40">
        {step === 3 && (
          <div className="mb-4 flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm font-semibold text-emerald-600 transition hover:text-emerald-800"
            >
              ← Назад до вибору днів
            </button>
            {sorted.length > 1 && (
              <div className="flex items-center gap-2">
                {sorted.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 w-2 rounded-full transition-all ${
                      idx === activeDayIndex ? "w-6 bg-emerald-500" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
            )}
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
          <div className="flex flex-col items-center gap-6 w-full max-w-6xl mx-auto">
            {currentDayItem && (
              <div
                key={currentDayItem.id}
                className={`w-full max-w-2xl group flex flex-col bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden transition-all duration-200 ease-out ${
                  isDaySelectable(currentDayItem.dayOfWeek) ? "hover:shadow-md" : "opacity-50"
                }`}
              >
                {currentDayItem.photoUrl && (
                  <div
                    className="relative h-64 w-full overflow-hidden bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setZoomedImage(currentDayItem.photoUrl || null);
                      setZoomScale(1);
                    }}
                  >
                    <img
                      src={currentDayItem.photoUrl}
                      alt={`${dayNames[currentDayItem.dayOfWeek]} menu`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                <div className="p-6 sm:p-8">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 pb-4">
                    <h3 className="break-words text-2xl font-black text-gray-900 sm:text-3xl">
                      {dayNames[currentDayItem.dayOfWeek] || `День ${currentDayItem.dayOfWeek}`}
                    </h3>
                    <span className="rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
                      {selectedPackageRaw ?? "—"}
                    </span>
                  </div>

                  {!isIndiv && !isSushka && (
                    <button
                      type="button"
                      onClick={() => toggleCustomMode(!isCustomMode)}
                      className="mb-6 w-full rounded-2xl border-2 border-dashed border-emerald-200 py-3 text-base font-bold text-emerald-600 transition-colors hover:bg-emerald-50 active:scale-95"
                    >
                      {isCustomMode ? "Повернутися до стандарту" : "Індивідуальна збірка"}
                    </button>
                  )}

                  {!isDaySelectable(currentDayItem.dayOfWeek) && (
                    <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                      Вибір этого дня закритий за дедлайном
                    </div>
                  )}
                  {indivSelected && (
                    <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                      {packageLimit.exact 
                        ? `Оберіть рівно ${packageLimit.limit} страв на день.` 
                        : `Оберіть від 1 до ${packageLimit.limit} страв на день.`}
                    </div>
                  )}

                  <div className="flex-grow">
                    <MealSection
                      itemId={currentDayItem.id}
                      category="breakfast"
                      title="Сніданок"
                      options={currentDayItem.dishes.breakfast}
                      disabled={!isDaySelectable(currentDayItem.dayOfWeek)}
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
                      itemId={currentDayItem.id}
                      category="lunch"
                      title="Обід"
                      options={currentDayItem.dishes.lunch}
                      disabled={!isDaySelectable(currentDayItem.dayOfWeek)}
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
                      itemId={currentDayItem.id}
                      category="dinner"
                      title="Вечеря"
                      options={currentDayItem.dishes.dinner}
                      disabled={!isDaySelectable(currentDayItem.dayOfWeek)}
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
                        itemId={currentDayItem.id}
                        category="snack"
                        title="Перекус"
                        options={currentDayItem.dishes.snack}
                        disabled={!isDaySelectable(currentDayItem.dayOfWeek)}
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
                      itemId={currentDayItem.id}
                      category="extra"
                      title="Додаткова страва (Sport)"
                      options={currentDayItem.dishes.extra}
                      disabled={!isDaySelectable(currentDayItem.dayOfWeek)}
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

                  <div className="mt-6 flex flex-col gap-4 border-t border-gray-100 pt-6">
                    <div className="flex items-center justify-between">
                      {progressByDay[currentDayItem.id]?.isComplete ? (
                        <p className="text-base font-bold text-emerald-600">День зібрано ✓</p>
                      ) : (
                        <p className="text-base font-bold text-gray-600">
                          Обрано {progressByDay[currentDayItem.id]?.selectedCount || 0} з {packageLimit.limit}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-4">
                      <button
                        type="button"
                        disabled={activeDayIndex === 0}
                        onClick={() => setActiveDayIndex(prev => prev - 1)}
                        className="flex-1 rounded-2xl border border-gray-200 bg-white py-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-30 active:scale-95"
                      >
                        ← Назад
                      </button>
                      {!isLastDay ? (
                        <button
                          type="button"
                          onClick={() => setActiveDayIndex(prev => prev + 1)}
                          className="flex-1 rounded-2xl bg-emerald-600 py-4 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95"
                        >
                          Наступний день →
                        </button>
                      ) : (
                        <div className="flex-1" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {zoomedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative w-full h-full flex items-center justify-center overflow-auto">
            <img
              src={zoomedImage}
              alt="Day menu details"
              style={{ transform: `scale(${zoomScale})` }}
              className="max-w-full max-h-full object-contain transition-transform duration-200 ease-out"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-full px-6 py-3 border border-white/20">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoomScale(prev => Math.max(0.5, prev - 0.25));
              }}
              className="text-white hover:text-emerald-400 p-2 transition-colors"
              title="Zoom Out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <span className="text-white font-mono text-sm w-12 text-center">{Math.round(zoomScale * 100)}%</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoomScale(prev => Math.min(3, prev + 0.25));
              }}
              className="text-white hover:text-emerald-400 p-2 transition-colors"
              title="Zoom In"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
          </div>

          <button
            className="absolute top-6 right-6 h-12 w-12 flex items-center justify-center rounded-full bg-white/10 text-white text-3xl hover:bg-white/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setZoomedImage(null);
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Floating Bubble Button */}
      {(!wizardFilterActive || isLastDay) && (
        <div className="fixed bottom-6 left-0 right-0 z-[999999] pointer-events-none px-4 flex justify-center transform-gpu translate-z-0">
          <div className="pointer-events-auto w-full max-w-md bg-white/95 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 rounded-full py-3 px-6 md:px-8 flex items-center justify-between gap-4 transition-all">
            <span className="text-slate-800 font-bold text-sm md:text-base whitespace-nowrap">
              Обрано днів: {completedDaysCount}
            </span>
            <Link
              href={canProceedToCheckout ? "/checkout" : "#"}
              onClick={(e) => !canProceedToCheckout && e.preventDefault()}
              className={`w-full sm:w-auto text-center bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-full transition-colors shadow-md hover:shadow-lg ${
                !canProceedToCheckout ? "bg-slate-300 shadow-none hover:shadow-none hover:bg-slate-300 text-slate-500 cursor-not-allowed" : ""
              }`}
            >
              Оформити &rarr;
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
