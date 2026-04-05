"use client";

import { useCallback, type ReactNode } from "react";
import type { MenuItem } from "@/lib/menu-types";
import { getMenuRowIdsForPackageDay } from "@/lib/menu-for-package";
import { getSelectableMenuDayNumbers, type PackageType } from "@/lib/order-logic";
import { useOrderStore } from "@/lib/orderStore";
import MenuGridClient from "./MenuGridClient";

const dayNames: Record<number, string> = {
  1: "Понеділок",
  2: "Вівторок",
  3: "Середа",
  4: "Четвер",
  5: "П’ятниця",
  6: "Субота",
  7: "Неділя",
};

const PACKAGE_CARDS: {
  id: PackageType;
  title: string;
  kcal: string;
  price: string;
}[] = [
  { id: "Slim", title: "Slim", kcal: "≈ 1450–1650 ккал", price: "від 450 ₴" },
  { id: "Balance", title: "Balance", kcal: "≈ 1750–1950 ккал", price: "від 520 ₴" },
  { id: "Active", title: "Active", kcal: "≈ 2100–2350 ккал", price: "від 580 ₴" },
  { id: "Sport", title: "Sport Active+", kcal: "≈ 2500–2800 ккал", price: "від 640 ₴" },
  { id: "Sushka", title: "Сушка", kcal: "≈ 1600–1800 ккал", price: "від 490 ₴" },
  { id: "Indiv", title: "Індивідуальний", kcal: "За вашим планом", price: "від 550 ₴" },
];

type Props = {
  menuItems: MenuItem[];
};

export default function OrderingWizardClient({ menuItems }: Props) {
  const orderWizardStep = useOrderStore((s) => s.orderWizardStep);
  const selectedPackage = useOrderStore((s) => s.selectedPackage);
  const selectedDates = useOrderStore((s) => s.selectedDates);
  const wizardSelectPackage = useOrderStore((s) => s.wizardSelectPackage);
  const setWizardStep = useOrderStore((s) => s.setWizardStep);
  const setSelectedDates = useOrderStore((s) => s.setSelectedDates);
  const clearDaySelections = useOrderStore((s) => s.clearDaySelections);

  const selectableDays = getSelectableMenuDayNumbers();

  const toggleDay = useCallback(
    (dow: number) => {
      const isOn = selectedDates.includes(dow);
      if (isOn) {
        const ids = getMenuRowIdsForPackageDay(menuItems, selectedPackage, dow);
        ids.forEach((id) => clearDaySelections(id));
        setSelectedDates(selectedDates.filter((d) => d !== dow));
      } else {
        setSelectedDates([...selectedDates, dow]);
      }
    },
    [clearDaySelections, menuItems, selectedDates, selectedPackage, setSelectedDates],
  );

  const stepShell = (step: number, title: string, children: ReactNode) => (
    <div
      key={step}
      className="transition-opacity duration-300 ease-out motion-reduce:transition-none"
    >
      <div className="mb-6 flex items-center justify-center gap-2">
        {([1, 2, 3] as const).map((n) => (
          <div
            key={n}
            className={`h-2 w-8 rounded-full transition-colors ${
              n === step ? "bg-blue-600" : n < step ? "bg-blue-200" : "bg-gray-200"
            }`}
            aria-hidden
          />
        ))}
      </div>
      <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">{title}</h2>
      {children}
    </div>
  );

  if (!menuItems.length) {
    return (
      <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
        Меню оновлюється
      </div>
    );
  }

  if (selectableDays.length === 0) {
    return (
      <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm font-semibold text-yellow-800">
        ⚠️ Наразі замовлення закриті. Меню на наступний тиждень публікується в суботу о 12:00 (приблизно). У
        п&apos;ятницю замовлення не приймаються.
      </div>
    );
  }

  return (
    <div className="min-h-[50vh]">
      {orderWizardStep === 1 &&
        stepShell(
          1,
          "Оберіть тариф",
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {PACKAGE_CARDS.map((pkg) => {
              const active = selectedPackage === pkg.id;
              return (
                <div
                  key={pkg.id}
                  className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ring-1 transition ${
                    active ? "border-blue-400 ring-blue-200" : "border-gray-200 ring-gray-100"
                  }`}
                >
                  <div className="bg-gray-200 h-48 w-full" />
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{pkg.title}</h3>
                      <p className="mt-1 text-sm text-gray-600">{pkg.kcal}</p>
                      <p className="text-sm font-semibold text-gray-800">{pkg.price}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => wizardSelectPackage(pkg.id)}
                      className="mt-auto rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
                    >
                      Обрати
                    </button>
                  </div>
                </div>
              );
            })}
          </div>,
        )}

      {orderWizardStep === 2 &&
        stepShell(
          2,
          "Оберіть дні доставки",
          <>
            <p className="mb-4 text-center text-sm text-gray-600">
              Доступні лише дні, для яких ще не минув дедлайн замовлення.
            </p>
            <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {selectableDays.map((dow) => {
                const on = selectedDates.includes(dow);
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
                onClick={() => setWizardStep(1)}
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                Назад
              </button>
              <button
                type="button"
                disabled={selectedDates.length === 0}
                onClick={() => setWizardStep(3)}
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
        )}

      {orderWizardStep === 3 && (
        <div className="transition-opacity duration-300 ease-out motion-reduce:transition-none">
          <div className="mb-4 flex items-center justify-center gap-2">
            {([1, 2, 3] as const).map((n) => (
              <div
                key={n}
                className={`h-2 w-8 rounded-full transition-colors ${
                  n === 3 ? "bg-blue-600" : "bg-blue-200"
                }`}
                aria-hidden
              />
            ))}
          </div>
          <h2 className="mb-4 text-center text-xl font-bold text-gray-900">Оберіть страви</h2>
          <MenuGridClient
            menuItems={menuItems}
            filterDayOfWeeks={selectedDates}
            hidePackageSwitcher
            onWizardBack={() => setWizardStep(2)}
          />
        </div>
      )}
    </div>
  );
}
