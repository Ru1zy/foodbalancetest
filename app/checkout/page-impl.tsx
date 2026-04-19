"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import TelegramDeepLinkAuth from "@/components/TelegramDeepLinkAuth";
import { submitOrder, type OrderCartData } from "@/app/actions/order-impl";
import {
  dateForMenuDayOfWeek,
  earliestMenuDeliveryDateFromCartDays,
  getOrderTotalUah,
  getPackageLimit,
  PACKAGE_PRICES,
} from "@/lib/order-logic";
import {
  clampCutleryCount,
  formatDisplayDate,
  formatScheduleDayLabel,
  parseCheckoutFormData,
  validateCheckoutFormValues,
} from "@/lib/checkout";
import {
  getDaySelectedCount,
  isIndivPackage,
  toIndivDishQuantities,
} from "@/lib/order-selection";
import { parsePackageType } from "@/lib/package-coerce";
import { useOrderStore } from "@/lib/orderStore";

type FeedbackState = {
  message: string;
  tone: "error" | "success";
};

type FieldErrors = Partial<Record<"address" | "cart" | "name" | "phone", string>>;

type SubmittedState = {
  packageType: string;
  totalDays: number;
};

type AuthenticatedUser = {
  name: string;
  phone: string | null;
  address: string | null;
  defaultCutlery: number | null;
} | null;

type Props = {
  authenticatedUser: AuthenticatedUser;
  menuDayByItemId: Record<string, number>;
  /** dayOfWeek (1–7) → menu row id для тарифу Сушка */
  sushkaMenuIdByDay: Record<number, string>;
};

export default function CheckoutPage({ authenticatedUser, menuDayByItemId, sushkaMenuIdByDay }: Props) {
  const router = useRouter();
  const customerProfile = useOrderStore((state) => state.customerProfile);
  const selectedPackageRaw = useOrderStore((state) => state.selectedPackage);
  const pkg = parsePackageType(selectedPackageRaw);
  const selections = useOrderStore((state) => state.selections);
  const selectedDates = useOrderStore((state) => state.selectedDates);
  const clearSelections = useOrderStore((state) => state.clearSelections);
  const clearDaySelections = useOrderStore((state) => state.clearDaySelections);
  const resetWizard = useOrderStore((state) => state.resetWizard);
  const setCustomerProfile = useOrderStore((state) => state.setCustomerProfile);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState<SubmittedState | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (authenticatedUser && !customerProfile.isAuthenticated) {
      // Parse legacy address if exists
      const legacyAddress = authenticatedUser.address || "";
      setCustomerProfile({
        name: authenticatedUser.name,
        phone: authenticatedUser.phone || "",
        street: legacyAddress, // Store legacy address in street for now
        house: "",
        apartment: "",
        entrance: "",
        intercom: "",
        cutlery: authenticatedUser.defaultCutlery || 0,
        isAuthenticated: true,
        // Keep other fields default
        userId: "",
        chatId: "",
        notes: "",
        username: "",
      });
    }
  }, [authenticatedUser, customerProfile.isAuthenticated, setCustomerProfile]);

  const packageLimit = getPackageLimit(pkg ?? undefined);
  const cartData = useMemo<OrderCartData>(() => {
    if (!pkg) {
      return {
        days: [],
        packageLimit: getPackageLimit(),
        packageType: "Slim",
        totalDays: 0,
      };
    }

    // For Sushka XS and Sushka S, use auto-fill logic
    if (pkg.includes("Sushka")) {
      const dowSorted = [...new Set(selectedDates.map((s) => Number(s)))]
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
        .sort((a, b) => a - b);

      const days = dowSorted
        .map((dow) => {
          const id = sushkaMenuIdByDay[dow];
          if (!id) {
            return null;
          }
          return {
            dayId: id,
            selectedCount: 0,
            selections: {} as Record<string, number>,
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);

      return {
        days,
        packageLimit,
        packageType: pkg,
        totalDays: days.length,
      };
    }

    const days = Object.entries(selections)
      .map(([dayId, daySelections]) => {
        const selectedCount = getDaySelectedCount(daySelections, pkg);

        if (isIndivPackage(selectedPackageRaw ?? undefined)) {
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
      packageType: pkg,
      totalDays: days.length,
    };
  }, [packageLimit, pkg, selectedDates, selectedPackageRaw, selections, sushkaMenuIdByDay]);

  const orderTotalUah = useMemo(() => {
    if (!pkg) return 0;
    // For Sushka packages, use the specific variant price
    if (pkg === "Sushka XS" || pkg === "Sushka S") {
      return PACKAGE_PRICES[pkg] * cartData.totalDays;
    }
    // For Sushka (folder), calculate based on selected variant from store
    if (pkg === "Sushka") {
      // This shouldn't happen in checkout as Sushka should be resolved to XS or S
      return 0;
    }
    return getOrderTotalUah(pkg, cartData.totalDays);
  }, [cartData.totalDays, pkg]);

  const deliveryDate = useMemo(
    () => earliestMenuDeliveryDateFromCartDays(cartData.days, menuDayByItemId),
    [cartData.days, menuDayByItemId],
  );

  const cartDaysSchedule = useMemo(() => {
    const ref = new Date();
    const entries = cartData.days
      .map((d) => {
        const dow = menuDayByItemId[d.dayId];
        if (!Number.isInteger(dow) || dow < 1 || dow > 7) {
          return null;
        }
        const date = dateForMenuDayOfWeek(dow, ref);
        return { date, dayId: d.dayId, dow, label: formatScheduleDayLabel(date) };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return entries;
  }, [cartData.days, menuDayByItemId]);

  const incompleteDaysCount = useMemo(() => {
    if (!pkg || pkg.includes("Sushka")) {
      return 0;
    }
    return Object.values(selections).filter((daySelections) => {
      const selectedCount = getDaySelectedCount(daySelections, pkg);
      return selectedCount > 0 && selectedCount !== packageLimit;
    }).length;
  }, [packageLimit, pkg, selections]);

  const formKey = useMemo(
    () =>
      [
        customerProfile.userId,
        customerProfile.name,
        customerProfile.phone,
        customerProfile.street,
        customerProfile.house,
        customerProfile.apartment,
        customerProfile.entrance,
        customerProfile.intercom,
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

    if (!pkg) {
      nextFieldErrors.cart = "Спочатку оберіть тариф і збережіть кошик на головній сторінці.";
    } else if (cartData.totalDays === 0) {
      nextFieldErrors.cart = pkg.includes("Sushka")
        ? "Для Сушки оберіть хоча б один день на кроці 2 або перевірте наявність меню в системі."
        : "Додайте хоча б один повністю зібраний день до кошика.";
    } else {
      // CRITICAL: Validate each day meets package requirements
      const isIndiv = isIndivPackage(selectedPackageRaw ?? undefined);
      const serverLimit = getPackageLimit(pkg);

      for (const day of cartData.days) {
        if (isIndiv) {
          // For Indiv: check 1-10 total dishes, max 3 per dish
          if (day.items) {
            const totalQty = day.items.reduce((sum, item) => sum + item.quantity, 0);
            if (totalQty < 1 || totalQty > 10) {
              nextFieldErrors.cart = `Для тарифу Indiv кожен день повинен містити від 1 до 10 страв. Перевірте кошик.`;
              break;
            }
            const hasInvalidQty = day.items.some(item => item.quantity > 3);
            if (hasInvalidQty) {
              nextFieldErrors.cart = `Для тарифу Indiv максимум 3 однакові страви на день. Перевірте кошик.`;
              break;
            }
          }
        } else {
          // For standard packages: must match exact limit
          if (day.selectedCount !== serverLimit) {
            nextFieldErrors.cart = `Для тарифу ${pkg} кожен день повинен містити рівно ${serverLimit} страв. Знайдено день з ${day.selectedCount} стравами.`;
            break;
          }
        }
      }
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFeedback(null);
      return;
    }

    setFieldErrors({});
    setFeedback(null);

    startTransition(async () => {
      if (!deliveryDate) {
        setFeedback({
          message: "Не вдалося визначити дату доставки за кошиком.",
          tone: "error",
        });
        return;
      }

      const result = await submitOrder(formData, cartData, deliveryDate, orderTotalUah);

      if (!result.ok) {
        setFeedback({
          message: result.message,
          tone: "error",
        });
        return;
      }

      setSubmitted({
        packageType: cartData.packageType,
        totalDays: cartData.totalDays,
      });
      setCustomerProfile({
        street: submittedValues.street,
        house: submittedValues.house,
        apartment: submittedValues.apartment,
        entrance: submittedValues.entrance,
        intercom: submittedValues.intercom,
        cutlery: submittedValues.cutlery,
        name: submittedValues.name,
        notes: submittedValues.comment,
        phone: submittedValues.phone,
        userId: result.userId,
      });
      clearSelections();
      resetWizard();
      setFeedback({
        message: "Замовлення успішно оформлено. Повертаємо на головну...",
        tone: "success",
      });

      // Don't auto-redirect - let user read the confirmation
    });
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-10 text-gray-800 sm:px-6">
        <section className="mx-auto max-w-3xl rounded-2xl bg-white/80 backdrop-blur-sm p-8 shadow-xl ring-1 ring-slate-200/60">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg shadow-green-500/30">
              <span className="text-5xl">✓</span>
            </div>
            <div className="mb-4 inline-flex rounded-full bg-gradient-to-r from-green-400 to-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg">
              Замовлення прийнято
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              Оформлення завершено
            </h1>
            <p className="text-sm text-slate-600 mb-8">
              Дякуємо за замовлення! Ми зв'яжемося з вами найближчим часом.
            </p>

            {/* Order Summary */}
            <div className="mt-6 space-y-4">
              <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6 border border-blue-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4">📋 Деталі замовлення</h2>
                <dl className="space-y-3 text-left">
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Тариф:</dt>
                    <dd className="text-sm font-bold text-slate-900">{submitted.packageType}</dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Кількість днів:</dt>
                    <dd className="text-sm font-bold text-slate-900">{submitted.totalDays}</dd>
                  </div>
                  {orderTotalUah > 0 && (
                    <div className="flex justify-between items-center pt-3 border-t border-blue-200">
                      <dt className="text-base font-semibold text-slate-900">Сума:</dt>
                      <dd className="text-xl font-bold text-blue-600">{orderTotalUah} ₴</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="rounded-xl bg-slate-50 p-6 border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-3">📞 Що далі?</h2>
                <ul className="space-y-2 text-left text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Ваше замовлення збережено в системі</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Наш менеджер зв'яжеться з вами для підтвердження</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Після оплати ви отримаєте підтвердження в Telegram</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Доставка здійснюється кур'єром за вказаною адресою</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl hover:scale-105"
              >
                <span>←</span>
                <span>Повернутися на головну</span>
              </Link>
              <Link
                href="/profile"
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <span>👤</span>
                <span>Переглянути профіль</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-10 text-gray-800 sm:px-6">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="rounded-2xl bg-white/80 backdrop-blur-sm p-6 shadow-xl ring-1 ring-slate-200/60 sm:p-8">
          <div className="mb-8">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700">
              <span>←</span> Повернутися до меню
            </Link>
            <h1 className="mt-4 text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Оформлення замовлення
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Заповніть коротку форму нижче. Telegram-авторизація не обов&apos;язкова: оформити замовлення
              можна і як гість.
            </p>
          </div>

          {feedback && (
            <div
              className={`mb-6 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm ${
                feedback.tone === "success"
                  ? "border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700"
                  : "border-red-200 bg-gradient-to-r from-red-50 to-rose-50 text-red-700"
              }`}
            >
              {feedback.message}
            </div>
          )}

          {!customerProfile.isAuthenticated && (
            <div className="mb-6 rounded-2xl border border-dashed border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
              <div className="mt-4">
                <TelegramDeepLinkAuth />
              </div>
            </div>
          )}

          {cartData.totalDays === 0 && (
            <div className="mb-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🛒</span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Кошик порожній</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Форма вже готова, але для відправки потрібно зібрати хоча б один день відповідно до ліміту
                    тарифу.
                  </p>
                </div>
              </div>
            </div>
          )}

          {fieldErrors.cart && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {fieldErrors.cart}
            </div>
          )}

          <form key={formKey} className="space-y-6" onSubmit={handleSubmit}>
            <input type="hidden" name="cutlery" value={customerProfile.cutlery} />

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-900">Крок 1. Ім&apos;я</span>
                <input
                  aria-invalid={fieldErrors.name ? "true" : "false"}
                  autoComplete="name"
                  className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:ring-4 ${
                    fieldErrors.name
                      ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                      : "border-slate-200 focus:border-blue-500 focus:ring-blue-100 hover:border-slate-300"
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
                <span className="mb-2 block text-sm font-bold text-slate-900">Крок 1. Телефон</span>
                <input
                  aria-invalid={fieldErrors.phone ? "true" : "false"}
                  autoComplete="tel"
                  className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:ring-4 ${
                    fieldErrors.phone
                      ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                      : "border-slate-200 focus:border-blue-500 focus:ring-blue-100 hover:border-slate-300"
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

            <div>
              <span className="mb-3 block text-sm font-semibold text-gray-900">Крок 2. Адреса доставки</span>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-gray-700">Вулиця *</span>
                  <input
                    aria-invalid={fieldErrors.address ? "true" : "false"}
                    autoComplete="street-address"
                    className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:ring-4 ${
                      fieldErrors.address
                        ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                        : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                    }`}
                    defaultValue={customerProfile.street}
                    name="street"
                    placeholder="Назва вулиці"
                    required
                    type="text"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-gray-700">Будинок *</span>
                  <input
                    aria-invalid={fieldErrors.address ? "true" : "false"}
                    className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:ring-4 ${
                      fieldErrors.address
                        ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                        : "border-gray-200 focus:border-blue-500 focus:ring-blue-100"
                    }`}
                    defaultValue={customerProfile.house}
                    name="house"
                    placeholder="Номер будинку"
                    required
                    type="text"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-gray-700">Квартира</span>
                  <input
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    defaultValue={customerProfile.apartment}
                    name="apartment"
                    placeholder="Номер квартири"
                    type="text"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-gray-700">Під&apos;їзд</span>
                  <input
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    defaultValue={customerProfile.entrance}
                    name="entrance"
                    placeholder="Номер під'їзду"
                    type="text"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-xs font-medium text-gray-700">Домофон</span>
                  <input
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    defaultValue={customerProfile.intercom}
                    name="intercom"
                    placeholder="Код домофону"
                    type="text"
                  />
                </label>
              </div>
              {fieldErrors.address && (
                <span className="mt-2 block text-sm text-red-600">{fieldErrors.address}</span>
              )}
            </div>

            <section className="rounded-3xl border border-gray-200 p-5">
              <div className="text-sm font-semibold text-gray-900">Крок 3. Кількість приборів</div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setCustomerProfile({
                      ...customerProfile,
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
                      ...customerProfile,
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
              <span className="mb-2 block text-sm font-semibold text-gray-900">Крок 4. Коментар</span>
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
                <span className="font-semibold text-gray-900">{selectedPackageRaw ?? "—"}</span>
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
                <span className="text-gray-500">Вартість</span>
                <span className="font-semibold text-gray-900">
                  {orderTotalUah > 0 ? `${orderTotalUah} ₴` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-500">Прибори</span>
                <span className="font-semibold text-gray-900">{customerProfile.cutlery}</span>
              </div>
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="shrink-0 text-gray-500">Перша доставка</span>
                <span className="text-right font-semibold text-gray-900">
                  {deliveryDate ? formatDisplayDate(deliveryDate) : "—"}
                </span>
              </div>
              <div className="text-sm">
                <div className="text-gray-500">Графік доставок</div>
                {cartDaysSchedule.length > 0 ? (
                  <ul className="mt-1.5 list-none space-y-1 text-right font-semibold text-gray-900">
                    {cartDaysSchedule.map((entry) => (
                      <li key={entry.dayId}>{entry.label}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-right font-semibold text-gray-900">—</p>
                )}
              </div>
            </div>
          </div>

          {cartDaysSchedule.length > 0 && (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Дні в кошику</div>
              <ul className="mt-3 space-y-2">
                {cartDaysSchedule.map((entry) => (
                  <li
                    key={entry.dayId}
                    className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2 last:border-b-0 last:pb-0"
                  >
                    <span className="text-sm font-medium text-gray-900">{entry.label}</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      onClick={() => clearDaySelections(entry.dayId)}
                      aria-label={`Видалити ${entry.label}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                        aria-hidden
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.78 41.78 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Видалити
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {incompleteDaysCount > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Незаповнені дні не потраплять у замовлення. Зараз неповних днів: {incompleteDaysCount}.
            </div>
          )}

          <div className="mt-4 text-sm text-gray-600">
            До бази буде передано тариф, адресу доставки, вартість та обрані дні з поточного кошика.
          </div>
        </aside>
      </section>
    </main>
  );
}
