import { OrderCartData } from "@/app/actions/order-impl";
import { formatDisplayDate } from "@/lib/checkout";
import { isIndivPackage } from "@/lib/order-selection";
import { CartItem } from "@/lib/orderStore";
import { SummaryDay } from "./types";
import { PlusCircle, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import TelegramDeepLinkAuth from "@/components/TelegramDeepLinkAuth";

type Props = {
  isAuthenticated?: boolean;
  cartData: OrderCartData;
  selectedPackageRaw: string | null;
  fiatPrice: number;
  balanceDaysToUse: number;
  deliveryDate: Date | null;
  cartItems: CartItem[];
  cartCopiesCount: number;
  grandGrossTotal: number;
  hasIndivInCart: boolean;
  isIndivCurrent: boolean;
  summaryDays: SummaryDay[];
  incompleteDaysCount: number;
  currentDraftValid: boolean;
  availableDays: number;
  paymentMethod: "plata" | "cash" | "bank_transfer";
  handleAddAnotherPackage: () => void;
  handleRemoveDay: (day: SummaryDay) => void;
  removeCartItem: (id: string) => void;
  decrementQuantity: (id: string) => void;
  incrementQuantity: (id: string) => void;
};

export function CheckoutSummaryAside({
  isAuthenticated,
  cartData,
  selectedPackageRaw,
  fiatPrice,
  balanceDaysToUse,
  deliveryDate,
  cartItems,
  cartCopiesCount,
  grandGrossTotal,
  hasIndivInCart,
  isIndivCurrent,
  summaryDays,
  incompleteDaysCount,
  currentDraftValid,
  availableDays,
  paymentMethod,
  handleAddAnotherPackage,
  handleRemoveDay,
  removeCartItem,
  decrementQuantity,
  incrementQuantity,
}: Props) {
  const totalDaysInCart = cartItems.reduce((acc, item) => acc + (item.dayCount * item.quantity), 0);
  const grandTotalDays = (currentDraftValid ? summaryDays.length : 0) + totalDaysInCart;

  // We can track expanded states for each item. 
  // Let's use a simple Set for expanded IDs.
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside className="h-fit rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-8 lg:sticky lg:top-24">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Підсумок
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-50">Кошик</h2>
        </div>
        <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-right">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Всього днів</div>
          <div className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50">{grandTotalDays}</div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Render Finalized Cart Items */}
        {cartItems.map((item) => {
          const itemIndiv = isIndivPackage(item.packageType);
          const isExpanded = expandedItems.has(item.id);
          
          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
            >
              <div className="bg-white dark:bg-slate-900 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-base font-bold text-slate-900 dark:text-slate-100">
                      {item.packageLabel}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 font-medium">
                      {item.dayCount} {item.dayCount === 1 ? "день" : "дн."}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                      {itemIndiv ? (
                        <span className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400">
                          Розрахунок менеджером
                        </span>
                      ) : (
                        `${item.unitPrice * item.quantity} ₴`
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => decrementQuantity(item.id)}
                        disabled={item.quantity <= 1}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-lg font-bold text-slate-700 dark:text-slate-300 shadow-sm transition hover:text-emerald-600 disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => incrementQuantity(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-lg font-bold text-slate-700 dark:text-slate-300 shadow-sm transition hover:text-emerald-600"
                      >
                        +
                      </button>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => removeCartItem(item.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-500 transition px-2 py-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Видалити
                    </button>
                  </div>

                  {item.dayLabels.length > 0 && (
                    <button 
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition"
                    >
                      {isExpanded ? "Сховати дні" : "Показати дні"}
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
              
              {isExpanded && item.dayLabels.length > 0 && (
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                    Обрані дати: <span className="text-slate-900 dark:text-slate-200 font-semibold">{item.dayLabels.join(", ")}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Render Current Draft Ration */}
        {(summaryDays.length > 0 || selectedPackageRaw) && (
          <div className="overflow-hidden rounded-2xl border-2 border-emerald-400 dark:border-emerald-600 shadow-sm relative">
            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] uppercase font-bold px-2 py-1 tracking-wider rounded-bl-lg">
              Формується
            </div>
            <div className="bg-white dark:bg-slate-900 px-5 py-5 pt-7">
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">{selectedPackageRaw ?? "Оберіть раціон"}</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {isIndivCurrent ? (
                    <span className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400">
                      Розрахунок менеджером
                    </span>
                  ) : fiatPrice === 0 && balanceDaysToUse > 0 ? (
                    "0 ₴"
                  ) : fiatPrice > 0 ? (
                    `${fiatPrice} ₴`
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              
              {availableDays > 0 && balanceDaysToUse > 0 && (
                <div className="mt-3 rounded-xl bg-emerald-500/10 p-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  З абонементу: -{balanceDaysToUse} дн.
                </div>
              )}
              
              <input
                type="hidden"
                name="paymentMethod"
                value={fiatPrice === 0 ? "balance" : paymentMethod}
              />
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              {summaryDays.length === 0 ? (
                <div className="text-sm text-slate-600 dark:text-slate-400 text-center py-1">
                  Поки немає повністю зібраних днів.
                </div>
              ) : (
                <ul className="space-y-3">
                  {summaryDays.map((day) => (
                    <li key={day.dayId} className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700/50 pb-3 last:border-0 last:pb-0">
                      <div className="min-w-0 pr-4">
                        <p className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{day.dayName}</p>
                        <p className="mt-0.5 break-words text-xs text-slate-500">{day.scheduleLabel}</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveDay(day)} 
                        className="text-xs font-semibold text-slate-400 hover:text-red-500 transition mt-0.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {incompleteDaysCount > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Увага: {incompleteDaysCount} дн. зібрані не повністю і не потраплять у замовлення.
        </div>
      )}

      {/* Modern Add Another Ration Button */}
      <button
        type="button"
        onClick={handleAddAnotherPackage}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-50 dark:hover:bg-emerald-900/30 active:scale-95"
      >
        <PlusCircle className="w-5 h-5" />
        Додати ще один раціон
      </button>

      {/* Grand Total */}
      {(cartItems.length > 0 || currentDraftValid) && (
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-slate-900 dark:bg-slate-800 px-5 py-4 shadow-lg">
          <span className="text-base font-semibold text-white">До сплати</span>
          <span className="text-2xl font-black text-emerald-400">
            {hasIndivInCart || isIndivCurrent ? (
              grandGrossTotal > 0 ? (
                <span className="text-base font-bold text-emerald-400">{grandGrossTotal} ₴ + Інд.</span>
              ) : (
                <span className="text-sm sm:text-base font-bold text-blue-400">Уточнюється менеджером</span>
              )
            ) : grandGrossTotal > 0 ? (
              `${grandGrossTotal} ₴`
            ) : (
              "—"
            )}
          </span>
        </div>
      )}

      {isAuthenticated === false && (
        <div className="mt-6 rounded-2xl border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 p-5 shadow-sm text-center">
          <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-400">
            Знижка до 15% 🍏
          </h3>
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            Авторизуйтесь через Telegram для покупки абонементів.
          </p>
          <div className="mt-4 flex justify-center">
            <TelegramDeepLinkAuth />
          </div>
        </div>
      )}
    </aside>
  );
}
