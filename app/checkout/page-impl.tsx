"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import TelegramLoginButton from "@/components/TelegramLoginButton.impl";
import { submitOrder, type OrderCartData } from "@/app/actions/order-impl";
import { getPackageLimit } from "@/lib/order-logic";
import {
  clampCutleryCount,
  getDeliveryMethodLabel,
  parseCheckoutFormData,
  type DeliveryMethod,
  validateCheckoutFormValues,
} from "@/src/lib/checkout";
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

type FieldErrors = Partial<Record<"address" | "cart" | "name" | "phone", string>>;

type SubmittedState = {
  deliveryMethod: DeliveryMethod;
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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
      Object.values(selections).filter((daySelections) => {
        const selectedCount = getDaySelectedCount(daySelections, selectedPackage);
        return selectedCount > 0 && selectedCount !== packageLimit;
      }).length,
    [packageLimit, selectedPackage, selections],
  );

  const formKey = useMemo(
    () =>
      [
        customerProfile.userId,
        customerProfile.name,
        customerProfile.phone,
        customerProfile.address,
        customerProfile.deliveryMethod,
        customerProfile.cutlery,
        customerProfile.notes,
      ].join("|"),
    [customerProfile],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const submittedValues = parseCheckoutFormData(formData);
    const nextFieldErrors = validateCheckoutFormValues(submittedValues);

    if (cartData.totalDays === 0) {
      nextFieldErrors.cart = "Додайте хоча б один повністю зібраний день до кошика.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFeedback(null);
      return;
    }

    setFieldErrors({});
    setFeedback(null);

    startTransition(async () => {
      const result = await submitOrder(formData, cartData);

      if (!result.ok) {
        setFeedback({
          message: result.message,
          tone: "error",
        });
        return;
      }

      setSubmitted({
        deliveryMethod: submittedValues.deliveryMethod,
        packageType: cartData.packageType,
        totalDays: cartData.totalDays,
      });
      setCustomerProfile({
        address:
          submittedValues.deliveryMethod === "delivery"
            ? submittedValues.address
            : customerProfile.address,
        cutlery: submittedValues.cutlery,
        deliveryMethod: submittedValues.deliveryMethod,
        name: submittedValues.name,
        notes: submittedValues.comment,
        phone: submittedValues.phone,
        userId: result.userId,
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
            Тариф: <span className="font-semibold text-gray-900">{submitted.packageType}</span>. Днів у
            замовленні: <span className="font-semibold text-gray-900">{submitted.totalDays}</span>. Спосіб
            отримання:{" "}
            <span className="font-semibold text-gray-900">
              {getDeliveryMethodLabel(submitted.deliveryMethod)}
            </span>
            .
          </p>
          <p className="mt-6 text-sm font-medium text-gray-600">
            Повертаємо вас на головну сторінку...
          </p>
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
              Заповніть коротку форму нижче. Telegram-авторизація не обов&apos;язкова: оформити замовлення
              можна і як гість.
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
            <div className="mb-6 rounded-3xl border border-dashed border-blue-200 bg-blue-50/70 p-4">
              <p className="text-sm text-blue-900">
                Вхід через Telegram необов&apos;язковий. Якщо хочете, можете використати його лише для
                автозаповнення профілю перед оформленням.
              </p>
              <div className="mt-4">
                <TelegramLoginButton />
              </div>
            </div>
          )}

          {cartData.totalDays === 0 && (
            <div className="mb-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6">
              <h2 className="text-lg font-semibold text-gray-900">Кошик порожній</h2>
              <p className="mt-2 text-sm text-gray-600">
                Форма вже готова, але для відправки потрібно зібрати хоча б один день відповідно до ліміту
                тарифу.
              </p>
            </div>
          )}

          {fieldErrors.cart && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {fieldErrors.cart}
            </div>
          )}

          <form key={formKey} className="space-y-5" onSubmit={handleSubmit}>
            <input type="hidden" name="cutlery" value={customerProfile.cutlery} />

            <fieldset className="rounded-3xl border border-gray-200 p-5">
              <legend className="px-2 text-sm font-semibold text-gray-900">Крок 1. Спосіб отримання</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(["delivery", "pickup"] as const).map((method) => {
                  const isActive = customerProfile.deliveryMethod === method;

                  return (
                    <label
                      key={method}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 transition ${
                        isActive
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <input
                        checked={isActive}
                        className="mt-1"
                        name="deliveryMethod"
                        onChange={() => setCustomerProfile({ deliveryMethod: method })}
                        type="radio"
                        value={method}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">
                          {getDeliveryMethodLabel(method)}
                        </span>
                        <span className="mt-1 block text-sm text-gray-600">
                          {method === "delivery"
                            ? "Курʼєр привезе замовлення за вказаною адресою."
                            : "Заберете замовлення самостійно, без адреси доставки."}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-900">Крок 2. Ім&apos;я</span>
                <input
                  aria-invalid={fieldErrors.name ? "true" : "false"}
                  autoComplete="name"
                  className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:ring-4 ${
                    fieldErrors.name
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                  defaultValue={customerProfile.name}
                  name="name"
                  placeholder="Як до вас звертатися"
                  required
                  type="text"
                />
                {fieldErrors.name && (
                  <span className="mt-2 block text-sm text-red-600">{fieldErrors.name}</span>
                )}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-900">Крок 2. Телефон</span>
                <input
                  aria-invalid={fieldErrors.phone ? "true" : "false"}
                  autoComplete="tel"
                  className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:ring-4 ${
                    fieldErrors.phone
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                  defaultValue={customerProfile.phone}
                  inputMode="tel"
                  name="phone"
                  placeholder="+380..."
                  required
                  type="tel"
                />
                {fieldErrors.phone && (
                  <span className="mt-2 block text-sm text-red-600">{fieldErrors.phone}</span>
                )}
              </label>
            </div>

            {customerProfile.deliveryMethod === "delivery" && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-900">Крок 3. Адреса</span>
                <input
                  aria-invalid={fieldErrors.address ? "true" : "false"}
                  autoComplete="street-address"
                  className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:ring-4 ${
                    fieldErrors.address
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                  defaultValue={customerProfile.address}
                  name="address"
                  placeholder="Вулиця, будинок, квартира, під'їзд"
                  required
                  type="text"
                />
                {fieldErrors.address && (
                  <span className="mt-2 block text-sm text-red-600">{fieldErrors.address}</span>
                )}
              </label>
            )}

            <section className="rounded-3xl border border-gray-200 p-5">
              <div className="text-sm font-semibold text-gray-900">Крок 4. Кількість приборів</div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setCustomerProfile({
                      cutlery: clampCutleryCount(customerProfile.cutlery - 1),
                    })
                  }
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 text-xl font-semibold text-gray-900 transition hover:border-gray-300"
                >
                  -
                </button>
                <div className="min-w-24 rounded-2xl bg-gray-50 px-4 py-3 text-center text-lg font-semibold text-gray-900">
                  {customerProfile.cutlery}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCustomerProfile({
                      cutlery: clampCutleryCount(customerProfile.cutlery + 1),
                    })
                  }
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 text-xl font-semibold text-gray-900 transition hover:border-gray-300"
                >
                  +
                </button>
                <p className="text-sm text-gray-500">Вкажіть кількість від 0 до 4.</p>
              </div>
            </section>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-900">Крок 5. Коментар</span>
              <textarea
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                defaultValue={customerProfile.notes}
                name="comment"
                placeholder="Деталі для курʼєра, побажання або орієнтири"
                rows={4}
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
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
              Сводка замовлення
            </div>
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
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-500">Спосіб отримання</span>
                <span className="font-semibold text-gray-900">
                  {getDeliveryMethodLabel(customerProfile.deliveryMethod)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-500">Прибори</span>
                <span className="font-semibold text-gray-900">{customerProfile.cutlery}</span>
              </div>
            </div>
          </div>

          {incompleteDaysCount > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Незаповнені дні не потраплять у замовлення. Зараз неповних днів: {incompleteDaysCount}.
            </div>
          )}

          <div className="mt-4 text-sm text-gray-600">
            До бази буде передано вибраний тариф, спосіб отримання та всі повністю зібрані дні з поточного
            кошика.
          </div>
        </aside>
      </section>
    </main>
  );
}
