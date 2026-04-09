"use client";

import type { MenuItem } from "@/lib/menu-types";
import { getSelectableMenuDayNumbers } from "@/lib/order-logic";
import { useOrderStore } from "@/lib/orderStore";
import DateSelector from "./DateSelector";
import MenuGridClient from "./MenuGridClient";
import PackageSelector from "./PackageSelector";
import SushkaPreview from "./SushkaPreview";

type Tariff = {
  id: string;
  name: string;
  title: string;
  kcal: string;
  price: string;
  basePrice: number;
  imageUrl: string | null;
};

type Props = {
  menuItems: MenuItem[];
  tariffs: Tariff[];
};

export default function OrderWizard({ menuItems, tariffs }: Props) {
  const step = useOrderStore((s) => s.step);
  const selectedPackage = useOrderStore((s) => s.selectedPackage);

  if (!menuItems.length) {
    return (
      <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
        Меню оновлюється
      </div>
    );
  }

  if (getSelectableMenuDayNumbers().length === 0) {
    return (
      <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm font-semibold text-yellow-800">
        ⚠️ Наразі замовлення закриті. Меню на наступний тиждень публікується в суботу о 12:00 (приблизно). У
        п&apos;ятницю замовлення не приймаються.
      </div>
    );
  }

  switch (step) {
    case 1:
      return <PackageSelector tariffs={tariffs} />;
    case 2:
      return <DateSelector menuItems={menuItems} />;
    case 3:
      return (
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
          <h2 className="mb-4 text-center text-xl font-bold text-gray-900">
            {selectedPackage === "Sushka" ? "Підтвердження (Сушка)" : "Оберіть страви"}
          </h2>
          {selectedPackage === "Sushka" ? (
            <SushkaPreview />
          ) : (
            <MenuGridClient menuItems={menuItems} />
          )}
        </div>
      );
    default:
      return <PackageSelector tariffs={tariffs} />;
  }
}
