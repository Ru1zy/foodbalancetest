import { useFormContext } from "react-hook-form";
import TelegramDeepLinkAuth from "@/components/TelegramDeepLinkAuth";
import { isIndivPackage } from "@/lib/order-selection";
import { CartItem } from "@/lib/orderStore";
import { CheckoutSchema } from "@/lib/validations";

type Props = {
  isAuthenticated: boolean;
  fiatPrice: number;
  balanceDaysToUse: number;
  paymentMethod: "plata" | "cash";
  setPaymentMethod: (m: "plata" | "cash") => void;
  cartItems: CartItem[];
  grandGrossTotal: number;
  hasIndivInCart: boolean;
  isIndivCurrent: boolean;
  orderTotalUah: number;
  selectedPackageRaw: string | null;
  isPending: boolean;
  cartTotalDays: number;
  onValidSubmit: (data: CheckoutSchema) => void;
  feedback: { message: string; tone: "error" | "success" } | null;
};

const CUTLERY_OPTIONS = [0, 1, 2, 3, 4] as const;

export function CheckoutCustomerForm({
  isAuthenticated,
  fiatPrice,
  balanceDaysToUse,
  paymentMethod,
  setPaymentMethod,
  cartItems,
  grandGrossTotal,
  hasIndivInCart,
  isIndivCurrent,
  orderTotalUah,
  selectedPackageRaw,
  isPending,
  cartTotalDays,
  onValidSubmit,
  feedback,
}: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useFormContext<CheckoutSchema>();

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Контактні дані</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-50">Куди і кому доставляти</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Telegram-авторизація допоможе швидше підтягнути ваші дані та отримати доступ до абонементів.
        </p>
      </div>

      {!isAuthenticated && (
        <div className="mb-8 rounded-2xl border-2 border-red-200 dark:border-red-800 bg-red-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900">Увага! Ви не авторизовані</h3>
              <p className="mt-1 text-sm leading-relaxed text-red-700">
                Щоб отримати знижки на пакети та доступ до абонементів, будь ласка, авторизуйтесь через Telegram.
              </p>
            </div>
            <div className="shrink-0">
              <TelegramDeepLinkAuth />
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Спосіб оплати</h3>

        {fiatPrice === 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/40 px-5 py-4">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="font-bold text-emerald-900">Повністю оплачено з абонемента</div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("plata")}
              className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition-all group ${
                paymentMethod === "plata"
                  ? "border-slate-950 dark:border-slate-800 bg-[#141414] ring-2 ring-slate-900/20 shadow-lg"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <div className="text-left">
                <div className={`font-extrabold text-lg ${paymentMethod === "plata" ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>
                  Plata <span className="font-normal opacity-70">by mono</span>
                </div>
                <div className={`text-xs mt-1 ${paymentMethod === "plata" ? "text-slate-400" : "text-slate-500"}`}>Apple Pay, Google Pay, Картка</div>
              </div>
              <div className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                paymentMethod === "plata" ? "border-white bg-white" : "border-slate-300 dark:border-slate-600"
              }`}>
                {paymentMethod === "plata" && <div className="h-2 w-2 rounded-full bg-[#141414]" />}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("cash")}
              className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition-all ${
                paymentMethod === "cash"
                  ? "border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/40 ring-2 ring-emerald-500/20"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:border-slate-600"
              }`}
            >
              <div className="text-left">
                <div className="font-bold text-slate-900 dark:text-slate-100">Готівкою</div>
                <div className="text-xs text-slate-500">При отриманні кур&apos;єру</div>
              </div>
              <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                paymentMethod === "cash" ? "border-emerald-500 dark:border-emerald-400 bg-emerald-500" : "border-slate-300 dark:border-slate-600"
              }`}>
                {paymentMethod === "cash" && <div className="h-2 w-2 rounded-full bg-white dark:bg-slate-900" />}
              </div>
            </button>
          </div>
        )}

        {paymentMethod === "plata" && fiatPrice > 0 && (
          <p className="mt-3 px-1 text-sm text-orange-600 dark:text-orange-500 italic">
            * Платіжні системи можуть стягувати додаткову комісію (1.3%).
          </p>
        )}

        {balanceDaysToUse > 0 && fiatPrice > 0 && (
          <p className="mt-3 px-1 text-xs text-slate-500">
            * Частина замовлення ({balanceDaysToUse} дн.) буде списана з вашого абонемента автоматично.
          </p>
        )}
      </div>

      {feedback && (
        <div
          className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
            feedback.tone === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit(onValidSubmit)}>
        <div className="grid gap-4 md:grid-cols-2 md:gap-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">Ім&apos;я</span>
            <input
              {...register("name")}
              aria-invalid={errors.name ? "true" : "false"}
              autoComplete="name"
              className={`w-full rounded-2xl border bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:ring-4 ${
                errors.name
                  ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                  : "border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:border-emerald-400 focus:ring-emerald-100"
              }`}
              placeholder="Як до вас звертатися"
              type="text"
            />
            {errors.name && (
              <span className="mt-2 block text-sm text-red-600">{errors.name.message}</span>
            )}
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">Телефон</span>
            <input
              {...register("phone")}
              aria-invalid={errors.phone ? "true" : "false"}
              autoComplete="tel"
              className={`w-full rounded-2xl border bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:ring-4 ${
                errors.phone
                  ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                  : "border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:border-emerald-400 focus:ring-emerald-100"
              }`}
              inputMode="tel"
              placeholder="0501234567"
              type="tel"
            />
            {errors.phone && (
              <span className="mt-2 block text-sm text-red-600">{errors.phone.message}</span>
            )}
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">Адреса доставки</span>
          <textarea
            {...register("address")}
            aria-invalid={errors.address ? "true" : "false"}
            autoComplete="street-address"
            className={`w-full rounded-2xl border bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:ring-4 ${
              errors.address
                ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                : "border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:border-emerald-400 focus:ring-emerald-100"
            }`}
            placeholder="Вулиця, будинок, квартира, під’їзд, орієнтир"
            rows={3}
          />
          {errors.address && (
            <span className="mt-2 block text-sm text-red-600">{errors.address.message}</span>
          )}
        </label>

        <div className="grid gap-4 md:grid-cols-2 md:gap-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">
              Кількість приборів
            </span>
            <select
              {...register("cutlery", { valueAsNumber: true })}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-emerald-500 dark:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              {CUTLERY_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">Коментар до замовлення</span>
          <textarea
            {...register("comment")}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-emerald-500 dark:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            placeholder="Побажання, деталі для курʼєра або зручний орієнтир"
            rows={4}
          />
        </label>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="flex h-6 items-center">
              <input
                type="checkbox"
                {...register("sendEmailReceipt")}
                className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-600"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Відправити квитанцію про оплату на Email
              </span>
              <span className="text-sm text-slate-500">
                Ми надішлемо копію чеку після підтвердження менеджером
              </span>
            </div>
          </label>
          {watch("sendEmailReceipt") && (
            <div className="mt-4 pl-8">
              <input
                type="email"
                {...register("receiptEmail")}
                placeholder="Введіть ваш Email..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-emerald-500 dark:border-emerald-400 focus:bg-white dark:bg-slate-900 focus:ring-4 focus:ring-emerald-100"
                aria-invalid={errors.receiptEmail ? "true" : "false"}
              />
              {errors.receiptEmail && (
                <p className="mt-1.5 text-sm font-medium text-red-500">
                  {errors.receiptEmail.message}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-950 px-5 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {cartItems.length > 0
                  ? grandGrossTotal > 0
                    ? `До підтвердження: ${grandGrossTotal} ₴${
                        hasIndivInCart || isIndivCurrent ? " + інд." : ""
                      }`
                    : "Індивідуальний розрахунок"
                  : isIndivPackage(selectedPackageRaw ?? undefined)
                  ? "Індивідуальний розрахунок"
                  : `До підтвердження: ${orderTotalUah} ₴`}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Натискаючи кнопку, ви передаєте замовлення менеджеру в обробку.
              </p>
            </div>
            <button
              type="submit"
              disabled={isPending || (cartTotalDays === 0 && cartItems.length === 0)}
              className={`inline-flex w-full items-center justify-center rounded-2xl px-6 py-4 text-base font-bold transition-all duration-200 ease-out active:scale-95 sm:w-full ${
                isPending || (cartTotalDays === 0 && cartItems.length === 0)
                  ? "cursor-not-allowed bg-slate-200 text-slate-400"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg"
              }`}
            >
              {isPending
                ? "Надсилаємо..."
                : cartItems.length > 0
                ? "Підтвердити замовлення"
                : balanceDaysToUse > 0
                ? fiatPrice > 0
                  ? `Оформити (${balanceDaysToUse} дні з балансу + ${fiatPrice} ₴)`
                  : `Оформити (списати ${balanceDaysToUse} дні з балансу)`
                : isIndivPackage(selectedPackageRaw ?? undefined)
                ? "Надіслати заявку"
                : "Підтвердити замовлення"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
