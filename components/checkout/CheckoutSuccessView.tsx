import Link from "next/link";
import { isIndivPackage } from "@/lib/order-selection";
import type { SubmittedState } from "./types";

type Props = {
  submitted: SubmittedState;
};

export function CheckoutSuccessView({ submitted }: Props) {
  return (
    <main className="min-h-[100dvh] bg-gray-50 dark:bg-slate-950 px-4 py-10 text-slate-900 dark:text-slate-100 md:px-8">
      <section className="mx-auto max-w-3xl rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-sm sm:p-10">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-600">
            ✓
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">
            Замовлення прийнято
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-slate-50">
            {isIndivPackage(submitted.packageType) && submitted.totalPrice === 0 ? "Заявку прийнято" : "Дякуємо за замовлення"}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            {isIndivPackage(submitted.packageType) && submitted.totalPrice === 0
              ? "Вашу заявку прийнято! З вами найближчим часом зв'яжеться оператор для погодження меню та кінцевої вартості."
              : "Ми вже зберегли ваше замовлення в системі. Найближчим часом менеджер зв'яжеться з вами для підтвердження деталей доставки."}
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 px-5 py-4 text-left">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Тариф</div>
            <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{submitted.packageType}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 px-5 py-4 text-left">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Днів</div>
            <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{submitted.totalDays}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 px-5 py-4 text-left">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Сума</div>
            <div className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              {submitted.totalPrice > 0 ? (
                `${submitted.totalPrice} ₴`
              ) : (
                "—"
              )}
            </div>
          </div>
        </div>

        {submitted.orderCount > 1 && (
          <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-5 py-4 text-sm text-slate-700 dark:text-slate-300">
            Створено замовлень: <span className="font-semibold">{submitted.orderCount}</span>.
          </div>
        )}

        {submitted.deliveryDateLabel && (
          <div className="mt-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/40 px-5 py-4 text-sm text-emerald-900 dark:text-emerald-300">
            Перша доставка запланована на <span className="font-semibold">{submitted.deliveryDateLabel}</span>.
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 dark:bg-slate-800 px-6 py-4 text-base font-bold text-white transition-all duration-200 ease-out hover:bg-emerald-600 active:scale-95 shadow-sm hover:shadow-md"
          >
            Повернутися до меню
          </Link>
          <Link
            href="/profile"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4 text-base font-bold text-gray-700 dark:text-slate-300 transition-all duration-200 ease-out hover:bg-gray-50 dark:bg-slate-950 active:scale-95"
          >
            Перейти до профілю
          </Link>
        </div>
      </section>
    </main>
  );
}
