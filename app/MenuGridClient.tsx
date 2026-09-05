"use client";

import Link from "next/link";
import { useMemo, useState, useRef } from "react";
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
  orderingMode?: "AUTO" | "FORCE_OPEN" | "FORCE_CLOSED";
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
              className="break-words text-sm text-gray-700 dark:text-slate-300"
            >
              {opt.full}
              {opt.short && opt.short !== opt.full && (
                <span className="text-xs text-gray-500 dark:text-slate-400"> ({opt.short})</span>
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
                  quantity > 0 ? "border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30" : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                } ${disabled ? "opacity-50" : ""}`}
              >
                <div className="break-words font-medium text-gray-800 dark:text-slate-200">{opt.full}</div>
                {opt.short && opt.short !== opt.full && (
                  <div className="break-words text-xs text-gray-500 dark:text-slate-400">{opt.short}</div>
                )}
                {options.length > 1 && (
                  <div className="mt-1 text-[9px] text-emerald-500 dark:text-emerald-400">ВАРІАНТ {idx + 1}</div>
                )}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">
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
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base font-bold text-gray-700 dark:text-slate-300 transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      -
                    </button>
                    <div className="min-w-8 text-center text-sm font-bold text-gray-900 dark:text-slate-100">{quantity}</div>
                    <button
                      type="button"
                      disabled={disabled || isAtLimit}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (disabled || isAtLimit) return;
                        incrementDish(itemId, dishId);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base font-bold text-emerald-600 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
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

export default function MenuGridClient({ menuItems, orderingMode = "AUTO" }: Props) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastTouchTimeRef = useRef(0);

  const resetZoom = () => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomScale <= 1) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomScale <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || zoomScale <= 1) return;
    setPan({
      x: e.touches[0].clientX - dragStartRef.current.x,
      y: e.touches[0].clientY - dragStartRef.current.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const now = Date.now();
    if (now - lastTouchTimeRef.current < 300) {
      if (zoomScale > 1) {
        resetZoom();
      } else {
        setZoomScale(2);
      }
    }
    lastTouchTimeRef.current = now;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (zoomScale <= 1) return;
    e.preventDefault();
    setPan((prev) => ({
      x: e.shiftKey ? prev.x - e.deltaY : prev.x,
      y: prev.y - e.deltaY,
    }));
  };

  const step = useOrderStore((state) => state.step);
  const selectedPackageRaw = useOrderStore((state) => state.selectedPackage);
  const selectedDatesFromStore = useOrderStore((state) => state.selectedDates);
  const setStep = useOrderStore((state) => state.setStep);
  const selections = useOrderStore((state) => state.selections);
  const incrementDish = useOrderStore((state) => state.incrementDish);
  const decrementDish = useOrderStore((state) => state.decrementDish);
  const setPackage = useOrderStore((state) => state.setPackage);
  const setSelection = useOrderStore((state) => state.setSelection);
  const customModeDays = useOrderStore((state) => state.customModeDays);
  const toggleCustomMode = useOrderStore((state) => state.toggleCustomMode);

  const [activeDayIndex, setActiveDayIndex] = useState(0);

  const pkg = parsePackageType(selectedPackageRaw);
  const isIndiv = isIndivPackage(selectedPackageRaw ?? undefined);
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

  const allClosed = [1, 2, 3, 4, 5, 6, 7].every((day) => !isDaySelectable(day, orderingMode));

  const hidePackageSwitcher = step === 3;
  const wizardFilterActive = step === 3 && selectedDatesFromStore.length > 0;

  if (!menuItems || menuItems.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border-2 border-solid border-gray-200 dark:border-slate-700">
        <p className="text-gray-500 dark:text-slate-400">Меню завантажується або порожнє...</p>
      </div>
    );
  }

  if (allClosed) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="rounded-xl border border-yellow-300 dark:border-yellow-700/60 bg-yellow-50 dark:bg-yellow-950/40 p-4 text-sm font-semibold text-yellow-800 dark:text-yellow-200">
          <div className="flex items-start gap-2.5">
            <span className="text-base select-none">⚠️</span>
            <div className="space-y-1">
              <p className="font-bold text-yellow-900 dark:text-yellow-100">Наразі замовлення закриті.</p>
              <p>Меню на наступний тиждень публікується в суботу о 12:00 (приблизно).</p>
              <p>У п&apos;ятницю замовлення не приймаються.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3 && !pkg) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-800 dark:border-amber-800 bg-amber-50 p-8 text-center text-sm text-amber-900">
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

  // Individual Selection is decided PER DAY: an Indiv tariff forces it for every
  // day, otherwise it follows this day's own toggle. Never a global flag.
  const currentDayCustom = currentDayItem ? !!customModeDays[currentDayItem.id] : false;
  const indivSelected = isIndiv || currentDayCustom;
  const currentDayComplete = currentDayItem
    ? (progressByDay[currentDayItem.id]?.isComplete ?? false)
    : false;

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
                      idx === activeDayIndex ? "w-6 bg-emerald-500" : "bg-gray-200 dark:bg-slate-700"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!hidePackageSwitcher && (
          <div className="mb-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap justify-center gap-1 rounded-xl bg-gray-100 dark:bg-slate-800 p-1 shadow-inner">
              {PACKAGES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPackage(type)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                    selectedPackageRaw === type
                      ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-sm"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300"
                  }`}
                >
                  {type === "Indiv" ? "INDIV" : type}
                </button>
              ))}
            </div>
          </div>
        )}

        {sorted.length === 0 && wizardFilterActive ? (
          <div className="rounded-2xl border border-solid border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-950 p-8 text-center text-sm text-gray-600 dark:text-slate-400">
            Для обраного тарифу немає карток меню на вибрані дні. Поверніться назад і змініть набір днів або тариф.
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full max-w-6xl mx-auto">
            {currentDayItem?.photoUrl && (
              <div
                onClick={() => {
                  setZoomedImage(currentDayItem.photoUrl || null);
                  resetZoom();
                }}
                className="w-full max-w-2xl flex items-center justify-between gap-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3.5 sm:px-5 sm:py-3 cursor-pointer text-amber-900 dark:text-amber-200 transition hover:bg-amber-100/80 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200/80 dark:bg-amber-800/60 text-base">
                    💡
                  </span>
                  <div className="text-xs sm:text-sm font-medium">
                    <span className="font-bold">Хочете роздивитися меню детальніше?</span> Натисніть на фотографію нижче — вона відкриється на весь екран з можливістю наближення!
                  </div>
                </div>
                <span className="hidden sm:inline-flex shrink-0 rounded-lg bg-amber-600 dark:bg-amber-500 text-white px-2.5 py-1 text-xs font-bold shadow-sm whitespace-nowrap">
                  🔍 Відкрити
                </span>
              </div>
            )}
            {currentDayItem && (
              <div
                key={currentDayItem.id}
                className={`w-full max-w-2xl group flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-all duration-200 ease-out ${
                  isDaySelectable(currentDayItem.dayOfWeek, orderingMode) ? "hover:shadow-md" : "opacity-50"
                }`}
              >
                {currentDayItem.photoUrl && (
                  <div className="w-full overflow-hidden bg-gray-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800">
                    <div
                      className="group/img relative h-64 sm:h-72 w-full cursor-pointer overflow-hidden bg-slate-900/5 dark:bg-slate-950 flex items-center justify-center"
                      onClick={() => {
                        setZoomedImage(currentDayItem.photoUrl || null);
                        resetZoom();
                      }}
                      title="Натисніть, щоб розгорнути меню на весь екран"
                    >
                      <img
                        src={currentDayItem.photoUrl}
                        alt={`${dayNames[currentDayItem.dayOfWeek]} menu`}
                        className="h-full w-full object-contain transition-transform duration-300 group-hover/img:scale-[1.03]"
                      />

                      {/* Top-right expand icon */}
                      <div className="absolute top-3 right-3 z-10 pointer-events-none">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/75 text-white shadow-lg backdrop-blur-md">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        </span>
                      </div>

                      {/* Bottom floating badge on the image */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none w-[92%] sm:w-auto text-center">
                        <span className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900/85 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md border border-white/20 transition-transform group-hover/img:scale-105">
                          <span>🔍</span>
                          <span>Натисніть на фото, щоб відкрити на весь екран</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="p-6 sm:p-8">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 pb-4">
                    <h3 className="break-words text-2xl font-black text-gray-900 dark:text-slate-100 sm:text-3xl">
                      {dayNames[currentDayItem.dayOfWeek] || `День ${currentDayItem.dayOfWeek}`}
                    </h3>
                    <span className="rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
                      {selectedPackageRaw ?? "—"}
                    </span>
                  </div>

                  {!isIndiv && !isSushka && (
                    <button
                      type="button"
                      onClick={() => toggleCustomMode(currentDayItem.id, !currentDayCustom)}
                      className="mb-6 w-full rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 shadow-sm dark:border-emerald-800 py-3 text-base font-bold text-emerald-600 transition-colors hover:bg-emerald-50 active:scale-95"
                    >
                      {currentDayCustom ? "Повернутися до стандарту" : "Індивідуальна збірка"}
                    </button>
                  )}

                  {!isDaySelectable(currentDayItem.dayOfWeek, orderingMode) && (
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
                      disabled={!isDaySelectable(currentDayItem.dayOfWeek, orderingMode)}
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
                      disabled={!isDaySelectable(currentDayItem.dayOfWeek, orderingMode)}
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
                      disabled={!isDaySelectable(currentDayItem.dayOfWeek, orderingMode)}
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
                        disabled={!isDaySelectable(currentDayItem.dayOfWeek, orderingMode)}
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
                      disabled={!isDaySelectable(currentDayItem.dayOfWeek, orderingMode)}
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

                  <div className="mt-6 flex flex-col gap-4 border-t border-gray-100 dark:border-slate-800 pt-6">
                    <div className="flex items-center justify-between">
                      {progressByDay[currentDayItem.id]?.isComplete ? (
                        <p className="text-base font-bold text-emerald-600">День зібрано ✓</p>
                      ) : (
                        <p className="text-base font-bold text-gray-600 dark:text-slate-400">
                          Обрано {progressByDay[currentDayItem.id]?.selectedCount || 0} з {packageLimit.limit}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-4">
                      <button
                        type="button"
                        disabled={activeDayIndex === 0}
                        onClick={() => {
                          setActiveDayIndex(prev => prev - 1);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="flex-1 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-4 text-sm font-bold text-gray-700 dark:text-slate-300 transition hover:bg-gray-50 dark:bg-slate-950 disabled:opacity-30 active:scale-95"
                      >
                        ← Назад
                      </button>
                      {!isLastDay ? (
                        <button
                          type="button"
                          disabled={!currentDayComplete}
                          onClick={() => {
                            if (!currentDayComplete) return;
                            setActiveDayIndex(prev => prev + 1);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`flex-1 rounded-2xl py-4 text-sm font-bold text-white transition active:scale-95 ${
                            currentDayComplete
                              ? "bg-emerald-600 hover:bg-emerald-700"
                              : "cursor-not-allowed bg-slate-300 text-slate-500"
                          }`}
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
          className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/90 p-4 select-none"
          onClick={() => {
            setZoomedImage(null);
            resetZoom();
          }}
        >
          {/* Top Title/Hint */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 text-white font-bold text-xs sm:text-base bg-black/60 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-white/10 max-w-[65%] sm:max-w-[80%] truncate shadow-lg">
            Меню {currentDayItem ? (dayNames[currentDayItem.dayOfWeek] || `День ${currentDayItem.dayOfWeek}`) : ""}
          </div>

          {/* Hint when zoomed */}
          {zoomScale > 1 && (
            <div className="absolute top-6 right-20 z-10 hidden sm:flex items-center gap-1.5 text-xs text-white/80 bg-black/50 backdrop-blur-md px-3.5 py-2 rounded-full border border-white/10">
              <span>🖐️</span> Перетягуйте мишкою або скрольте колесиком
            </div>
          )}

          <div
            className="relative w-full h-full flex items-center justify-center overflow-hidden touch-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            <img
              src={zoomedImage}
              alt="Day menu details"
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoomScale})`,
                transformOrigin: "center center",
                cursor: zoomScale > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
                transition: isDragging ? "none" : "transform 0.15s ease-out",
                maxHeight: "88vh",
                maxWidth: "92vw",
              }}
              draggable={false}
              className="object-contain select-none shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={() => {
                if (zoomScale > 1) {
                  resetZoom();
                } else {
                  setZoomScale(2);
                }
              }}
            />
          </div>

          {/* Zoom Controls */}
          <div
            className="absolute bottom-5 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-3 bg-black/75 backdrop-blur-md rounded-full px-3.5 py-1.5 sm:px-6 sm:py-2.5 border border-white/20 shadow-2xl z-30 max-w-[95vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setZoomScale((prev) => {
                  const next = Math.max(1, +(prev - 0.5).toFixed(1));
                  if (next === 1) setPan({ x: 0, y: 0 });
                  return next;
                });
              }}
              disabled={zoomScale <= 1}
              className="text-white hover:text-emerald-400 p-1.5 transition-colors disabled:opacity-30 disabled:hover:text-white"
              title="Віддалити"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>

            <button
              type="button"
              onClick={resetZoom}
              className="text-white hover:text-emerald-400 font-mono text-xs sm:text-sm px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-center min-w-[54px]"
              title="Натисніть для скидання до 100%"
            >
              {Math.round(zoomScale * 100)}%
            </button>

            <button
              type="button"
              onClick={() => {
                setZoomScale((prev) => Math.min(3, +(prev + 0.5).toFixed(1)));
              }}
              disabled={zoomScale >= 3}
              className="text-white hover:text-emerald-400 p-1.5 transition-colors disabled:opacity-30 disabled:hover:text-white"
              title="Наблизити"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>

            {zoomScale > 1 && (
              <button
                type="button"
                onClick={resetZoom}
                className="ml-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1 rounded bg-emerald-950/60 border border-emerald-700/50"
                title="Скинути зум і позицію"
              >
                Скинути
              </button>
            )}
          </div>

          {/* Close Button */}
          <button
            type="button"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white text-2xl sm:text-3xl border border-white/20 transition shadow-lg z-30"
            onClick={(e) => {
              e.stopPropagation();
              setZoomedImage(null);
              resetZoom();
            }}
            title="Закрити (Esc)"
          >
            &times;
          </button>
        </div>
      )}

      {/* Floating Bubble Button */}
      {!zoomedImage && (!wizardFilterActive || isLastDay) && (
        <div className="fixed bottom-6 left-0 right-0 z-[999999] pointer-events-none px-4 flex justify-center transform-gpu translate-z-0">
          <div className="pointer-events-auto w-full max-w-md bg-white dark:bg-slate-900/95 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 dark:border-slate-700 rounded-full py-3 px-6 md:px-8 flex items-center justify-between gap-4 transition-all">
            <span className="text-slate-800 dark:text-slate-200 font-bold text-sm md:text-base whitespace-nowrap">
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
