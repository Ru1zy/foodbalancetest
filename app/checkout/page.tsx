"use client";

import TelegramLoginButton from "@/components/TelegramLoginButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { submitOrder, type OrderCartData } from "@/app/actions/order";
import { getPackageLimit } from "@/lib/order-logic";
import {
  getDaySelectedCount,
  isIndivPackage,
  toIndivDishQuantities,
} from "@/src/lib/order-selection";
import { useOrderStore } from "@/src/store/orderStore";

type FeedbackState = {
  message: string;
  tone: "error" | "success";
};

type SubmittedState = {
  packageType: string;
  totalDays: number;
};

export default function CheckoutPage() {
  const router = useRouter();
  const customerProfile = useOrderStore((state) => state.customerProfile);
  const selectedPackage = useOrderStore((state) => state.selectedPackage);
  const selections = useOrderStore((state) => state.selections);
  const clearSelections = useOrderStore((state) => state.clearSelections);
  const setCustomerProfile = useOrderStore((state) => state.setCustomerProfile);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedState | null>(null);
  const [isPending, startTransition] = useTransition();

  const packageLimit = getPackageLimit(selectedPackage);
  const cartData = useMemo<OrderCartData>(() => {
    const days = Object.entries(selections)
      .map(([dayId, daySelections]) => {
        const selectedCount = getDaySelectedCount(daySelections, selectedPackage);

        if (isIndivPackage(selectedPackage)) {
          return {
            dayId,
            items: toIndivDishQuantities(daySelections),
            selectedCount,
          };
        }

        return {
          dayId,
          selectedCount,
          selections: daySelections,
        };
      })
      .filter((day) => day.selectedCount === packageLimit);

    return {
      days,
      packageLimit,
      packageType: selectedPackage,
      totalDays: days.length,
    };
  }, [packageLimit, selectedPackage, selections]);

  const incompleteDaysCount = useMemo(
    () =>
      Object.values(selections).filter(
        (daySelections) => {
          const selectedCount = getDaySelectedCount(daySelections, selectedPackage);
          return selectedCount > 0 && selectedCount !== packageLimit;
        },
      ).length,
    [packageLimit, selectedPackage, selections],
  );

  const formKey = useMemo(
    () =>
      [
        customerProfile.userId,
        customerProfile.name,
        customerProfile.phone,
        customerProfile.address,
        customerProfile.cutlery,
        customerProfile.notes,
      ].join("|"),
    [customerProfile],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const submittedValues = {
      address: String(formData.get("address") || "").trim(),
      comment: String(formData.get("comment") || "").trim(),
      cutlery: String(formData.get("cutlery") || "Так").trim() || "Так",
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
    };
    const nextCartData = cartData;

    setFeedback(null);

    startTransition(async () => {
      const result = await submitOrder(formData, nextCartData);

      if (!result.ok) {
        setFeedback({
          message: result.message,
          tone: "error",
        });
        return;
      }

      setSubmitted({
        packageType: nextCartData.packageType,
        totalDays: nextCartData.totalDays,
      });
      setCustomerProfile({
        address: submittedValues.address,
        cutlery: submittedValues.cutlery,
        userId: result.userId,
        name: submittedValues.name,
        notes: submittedValues.comment,
        phone: submittedValues.phone,
      });
      clearSelections();
      setFeedback({
        message: "Замовлення успішно оформлено. Повертаємо на головну...",
        tone: "success",
      });

      window.setTimeout(() => {
        router.replace("/");
      }, 1200);
    });
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-gray-100 px-4 py-10 text-gray-800 sm:px-6">
        <section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
            Замовлення прийнято
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Оформлення завершено</h1>
          <p className="mt-3 text-sm text-gray-600">
            Тариф: <span className="font-semibold text-gray-900">{submitted.packageType}</span>. Днів у замовленні:{" "}
            <span className="font-semibold text-gray-900">{submitted.totalDays}</span>.
          </p>
          <p className="mt-6 text-sm font-medium text-gray-600">Повертаємо вас на головну сторінку...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-10 text-gray-800 sm:px-6">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
          <div className="mb-8">
            <Link href="/" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
              ← Повернутися до меню
            </Link>
            <h1 className="mt-4 text-3xl font-bold text-gray-900">Оформлення замовлення</h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-600">
              Заповніть контактні дані, а ми збережемо ваше замовлення та передамо його в обробку.
            </p>
          </div>

          {feedback && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
                feedback.tone === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {feedback.message}
            </div>
          )}

          {!customerProfile.isAuthenticated && (
            <div className="mb-6">
              <TelegramLoginButton />
            </div>
          )}

          {cartData.totalDays === 0 && (
            <div className="mb-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6">
              <h2 className="text-lg font-semibold text-gray-900">Кошик порожній</h2>
              <p className="mt-2 text-sm text-gray-600">
                Форма доступна вже зараз, але для відправки потрібно зібрати хоча б один день відповідно до ліміту тарифу.
              </p>
            </div>
          )}

          <form key={formKey} className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-900">Ім&apos;я</span>
                <input
                  name="name"
                  type="text"
                  defaultValue={customerProfile.name}
                  autoComplete="name"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="Як до вас звертатися"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-900">Телефон</span>
                <input
                  required
                  name="phone"
                  type="tel"
                  defaultValue={customerProfile.phone}
                  inputMode="tel"
                  autoComplete="tel"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="+380..."
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-900">Адреса доставки</span>
              <input
                name="address"
                type="text"
                defaultValue={customerProfile.address}
                autoComplete="street-address"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Вулиця, будинок, квартира, під'їзд"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-900">Прибори</span>
              <select
                name="cutlery"
                defaultValue={customerProfile.cutlery || "Так"}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="Так">Так</option>
                <option value="Ні">Ні</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-900">Коментар</span>
              <textarea
                name="comment"
                rows={4}
                defaultValue={customerProfile.notes}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Деталі для кур'єра, побажання, орієнтири"
              />
            </label>

            <div className="flex flex-col gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Натискаючи кнопку, ви підтверджуєте відправку замовлення в обробку.
              </p>
              <button
                type="submit"
                disabled={isPending || cartData.totalDays === 0}
                className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                  isPending || cartData.totalDays === 0
                    ? "cursor-not-allowed bg-gray-200 text-gray-400"
                    : "bg-gray-900 text-white hover:bg-blue-600"
                }`}
              >
                {isPending ? "Надсилаємо..." : "Оформити замовлення"}
              </button>
            </div>
          </form>
        </div>

        <aside className="h-fit rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
          <div className="rounded-2xl bg-gray-50 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">Сводка замовлення</div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-500">Тариф</span>
                <span className="font-semibold text-gray-900">{selectedPackage}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-500">Ліміт страв на день</span>
                <span className="font-semibold text-gray-900">{packageLimit}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-500">Днів у замовленні</span>
                <span className="font-semibold text-gray-900">{cartData.totalDays}</span>
              </div>
            </div>
          </div>

          {incompleteDaysCount > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Незаповнені дні не потраплять у замовлення. Зараз неповних днів: {incompleteDaysCount}.
            </div>
          )}

          <div className="mt-4 text-sm text-gray-600">
            До бази буде передано вибраний тариф і всі повністю зібрані дні з поточного кошика.
          </div>
        </aside>
      </section>
    </main>
  );
}
