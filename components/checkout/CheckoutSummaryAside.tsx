import { OrderCartData } from "@/app/actions/order-impl";
import { formatDisplayDate } from "@/lib/checkout";
import { isIndivPackage } from "@/lib/order-selection";
import { CartItem } from "@/lib/orderStore";
import { SummaryDay } from "./types";

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
  const grandTotalDays = cartData.totalDays + totalDaysInCart;

  return (
    <aside className="h-fit rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-8 lg:sticky lg:top-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Підсумок
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-50">Ваше замовлення</h2>
        </div>
        <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-right">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Днів</div>
          <div className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50">{grandTotalDays}</div>
        </div>
      </div>

      {cartItems.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Додані раціони
            </h3>
            <span className="text-xs font-medium text-slate-500">
              {cartItems.length} поз. · {cartCopiesCount} шт.
            </span>
          </div>

          <ul className="space-y-3">
            {cartItems.map((item) => {
              const itemIndiv = isIndivPackage(item.packageType);
              return (
                <li
                  key={item.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.packageLabel}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.dayCount} {item.dayCount === 1 ? "день" : "дн."}
                        {item.dayLabels.length > 0 && (
                          <span className="break-words"> · {item.dayLabels.join(", ")}</span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCartItem(item.id)}
                      className="inline-flex shrink-0 items-center self-start rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 active:scale-95"
                    >
                      Видалити
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => decrementQuantity(item.id)}
                        disabled={item.quantity <= 1}
                        aria-label="Зменшити кількість"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg font-bold text-slate-700 dark:text-slate-300 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center text-base font-black text-slate-900 dark:text-slate-100">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => incrementQuantity(item.id)}
                        aria-label="Збільшити кількість"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg font-bold text-emerald-600 transition hover:border-emerald-300 active:scale-95"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right text-sm font-bold text-slate-900 dark:text-slate-100">
                      {itemIndiv
                        ? "Індивідуально"
                        : `${item.unitPrice * item.quantity} ₴`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Раціон, що формується
          </h3>
          {summaryDays.length > 0 && (
            <span className="text-xs font-medium text-slate-500">{summaryDays.length} поз.</span>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="bg-slate-950 px-5 py-5 text-white">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-300">Тариф</span>
              <span className="text-sm font-semibold text-white">{selectedPackageRaw ?? "—"}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-300">До сплати</span>
              <span className={`${isIndivCurrent ? "text-xl" : "text-3xl"} font-black text-white`}>
                {isIndivCurrent ? (
                  "Індивідуальний розрахунок"
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
              <div className="mt-4 rounded-xl bg-emerald-500/20 p-3 text-xs font-semibold text-emerald-200 border border-emerald-500 dark:border-emerald-400/30">
                {fiatPrice === 0
                  ? `Ви використовуєте свій абонемент. З балансу буде списано ${balanceDaysToUse} дні(в).`
                  : `Часткова оплата: з балансу буде списано ${balanceDaysToUse} дні(в). Залишок до сплати: ${fiatPrice} ₴.`}
              </div>
            )}
            <input
              type="hidden"
              name="paymentMethod"
              value={fiatPrice === 0 ? "balance" : paymentMethod}
            />
            <div className="mt-3 flex items-start justify-between gap-3">
              <span className="text-sm text-slate-300">Перша доставка</span>
              <span className="text-right text-sm font-semibold text-white">
                {deliveryDate ? formatDisplayDate(deliveryDate) : "—"}
              </span>
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-900 px-5 py-4">
            {summaryDays.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-400 text-center py-2">
                Поки що немає повністю зібраних днів. Поверніться до меню та додайте хоча б один день.
              </div>
            ) : (
              <ul className="space-y-3">
                {summaryDays.map((day) => (
                  <li key={day.dayId} className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0 pr-4">
                      <p className="break-words text-sm font-bold text-slate-900 dark:text-slate-100">{day.dayName}</p>
                      <p className="mt-0.5 break-words text-xs text-slate-500">{day.scheduleLabel}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveDay(day)} 
                      className="text-xs font-semibold text-red-500 hover:text-red-700 transition"
                    >
                      Видалити
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {incompleteDaysCount > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Неповністю зібрані дні не потраплять у замовлення. Зараз таких днів: {incompleteDaysCount}.
        </div>
      )}

      <button
        type="button"
        onClick={handleAddAnotherPackage}
        className="mt-6 w-full rounded-2xl border-2 border-solid border-emerald-300 py-3.5 text-sm font-bold text-emerald-600 transition hover:bg-emerald-50 active:scale-95"
      >
        + Додати ще один раціон
      </button>

      {(cartItems.length > 0 || (currentDraftValid && grandGrossTotal > 0)) && (
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-slate-100 dark:bg-slate-800 px-5 py-4 border border-slate-200 dark:border-slate-700">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Разом за всі раціони</span>
          <span className="text-xl font-black text-slate-950 dark:text-slate-50">
            {grandGrossTotal > 0 ? `${grandGrossTotal} ₴` : "—"}
            {(hasIndivInCart || isIndivCurrent) && (
              <span className="ml-1 align-middle text-xs font-medium text-slate-500">
                + інд.
              </span>
            )}
          </span>
        </div>
      )}

      {isAuthenticated === false && (
        <div className="mt-6 rounded-2xl border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 p-5 shadow-sm text-center">
          <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-400">
            Хочете замовляти зі знижкою до 15%? 🍏
          </h3>
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            Авторизуйтесь через Telegram, щоб купувати вигідні абонементи та керувати своїм розкладом!
          </p>
          <div className="mt-4 flex justify-center">
            <TelegramDeepLinkAuth />
          </div>
        </div>
      )}
    </aside>
  );
}
