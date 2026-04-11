"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useOrderStore } from "@/lib/orderStore";
import { parsePackageType } from "@/lib/package-coerce";
import { getDaySelectedCount, isIndivPackage } from "@/lib/order-selection";
import { getPackageLimit, getOrderTotalUah } from "@/lib/order-logic";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  menuDayByItemId: Record<string, number>;
};

const dayNames: Record<number, string> = {
  1: "Понеділок",
  2: "Вівторок",
  3: "Середа",
  4: "Четвер",
  5: "П'ятниця",
  6: "Субота",
  7: "Неділя",
};

export default function CartPanel({ isOpen, onClose, menuDayByItemId }: Props) {
  const router = useRouter();
  const [isAnimating, setIsAnimating] = useState(false);

  const selectedPackageRaw = useOrderStore((state) => state.selectedPackage);
  const selections = useOrderStore((state) => state.selections);
  const clearDaySelections = useOrderStore((state) => state.clearDaySelections);

  const pkg = parsePackageType(selectedPackageRaw);
  const packageLimit = getPackageLimit(pkg ?? undefined);
  const indivSelected = isIndivPackage(selectedPackageRaw ?? undefined);

  const completedDays = useMemo(() => {
    if (!pkg) return [];

    return Object.entries(selections)
      .filter(([_, daySelections]) => {
        const selectedCount = getDaySelectedCount(daySelections, pkg);
        return indivSelected ? selectedCount >= 1 : selectedCount === packageLimit;
      })
      .map(([dayId]) => {
        const dow = menuDayByItemId[dayId];
        return {
          dayId,
          dayName: dayNames[dow] || `День ${dow}`,
          dayOfWeek: dow,
        };
      })
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }, [selections, pkg, packageLimit, menuDayByItemId, indivSelected]);

  const totalPrice = useMemo(() => {
    if (!pkg) return 0;
    return getOrderTotalUah(pkg, completedDays.length);
  }, [pkg, completedDays.length]);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleRemoveDay = (dayId: string) => {
    clearDaySelections(dayId);
  };

  const handleCheckout = () => {
    router.push("/checkout");
    onClose();
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        onTransitionEnd={() => {
          if (!isOpen) setIsAnimating(false);
        }}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900">Ваш кошик</h2>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {completedDays.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-12 w-12 text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-gray-900">Кошик порожній</p>
                <p className="mt-2 text-sm text-gray-500">Оберіть страви з меню</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedDays.map((day, index) => (
                  <div
                    key={day.dayId}
                    className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md"
                    style={{
                      animation: `slideIn 0.3s ease-out ${index * 0.05}s both`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{day.dayName}</h3>
                        <p className="text-xs text-gray-500">{selectedPackageRaw}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveDay(day.dayId)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <svg className="h-5 w-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {completedDays.length > 0 && (
            <div className="border-t border-gray-200 p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">Всього днів:</span>
                <span className="text-2xl font-bold text-gray-900">{completedDays.length}</span>
              </div>
              <div className="mb-6 flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">До сплати:</span>
                <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {totalPrice} ₴
                </span>
              </div>
              <button
                onClick={handleCheckout}
                className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 py-4 text-lg font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105"
              >
                Оформити замовлення
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
