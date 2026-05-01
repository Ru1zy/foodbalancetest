"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState, useTransition } from "react";
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
  DELIVERY_TIME_OPTIONS,
  formatDisplayDate,
  formatScheduleDayLabel,
  normalizeDeliveryTime,
  parseCheckoutFormData,
  validateCheckoutFormValues,
} from "@/lib/checkout";
import {
  getDaySelectedCount,
  isDaySelectionComplete,
  isIndivPackage,
  toIndivDishQuantities,
} from "@/lib/order-selection";
import { parsePackageType } from "@/lib/package-coerce";
import { useOrderStore } from "@/lib/orderStore";
import { isTelegramPlaceholderPhone, sanitizeTelegramPhone } from "@/lib/telegram-phone";

type FeedbackState = {
  message: string;
  tone: "error" | "success";
};

type FieldErrors = Partial<Record<"address" | "cart" | "name" | "phone", string>>;

type SubmittedState = {
  deliveryDateLabel: string | null;
  packageType: string;
  totalDays: number;
  totalPrice: number;
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
  sushkaMenuIdByDay: Record<number, string>;
};

type SummaryDay = {
  dayId: string;
  dayName: string;
  dayOfWeek: number;
  scheduleLabel: string;
};

const CUTLERY_OPTIONS = [0, 1, 2, 3, 4] as const;

const dayNames: Record<number, string> = {
  1: "Понеділок",
  2: "Вівторок",
  3: "Середа",
  4: "Четвер",
  5: "П’ятниця",
  6: "Субота",
  7: "Неділя",
};

export default function CheckoutPageImpl({
  authenticatedUser,
  menuDayByItemId,
  sushkaMenuIdByDay,
}: Props) {
  const customerProfile = useOrderStore((state) => state.customerProfile);
  const selectedPackageRaw = useOrderStore((state) => state.selectedPackage);
  const selectedDates = useOrderStore((state) => state.selectedDates);
  const selections = useOrderStore((state) => state.selections);
  const clearSelections = useOrderStore((state) => state.clearSelections);
  const clearDaySelections = useOrderStore((state) => state.clearDaySelections);
  const resetWizard = useOrderStore((state) => state.resetWizard);
  const setCustomerProfile = useOrderStore((state) => state.setCustomerProfile);
  const setSelectedDates = useOrderStore((state) => state.setSelectedDates);
  const pkg = parsePackageType(selectedPackageRaw);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState<SubmittedState | null>(null);
  const [isPending, startTransition] = useTransition();
  const normalizedPhone = sanitizeTelegramPhone(customerProfile.phone);
  const normalizedDeliveryTime = normalizeDeliveryTime(customerProfile.deliveryTime);

  useEffect(() => {
    if (!authenticatedUser || customerProfile.isAuthenticated) {
      return;
    }

    setCustomerProfile({
      address: authenticatedUser.address || "",
      cutlery: authenticatedUser.defaultCutlery || 0,
      deliveryTime: "",
      isAuthenticated: true,
      name: authenticatedUser.name,
      phone: authenticatedUser.phone || "",
      userId: "",
      chatId: "",
      notes: "",
      username: "",
    });
  }, [authenticatedUser, customerProfile.isAuthenticated, setCustomerProfile]);

  useEffect(() => {
    if (!isTelegramPlaceholderPhone(customerProfile.phone)) {
      return;
    }

    setCustomerProfile({ phone: "" });
  }, [customerProfile.phone, setCustomerProfile]);

  useEffect(() => {
    if (customerProfile.deliveryTime === normalizedDeliveryTime) {
      return;
    }

    setCustomerProfile({ deliveryTime: normalizedDeliveryTime });
  }, [customerProfile.deliveryTime, normalizedDeliveryTime, setCustomerProfile]);

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

    if (pkg.includes("Sushka")) {
      const dayOfWeeks = [...new Set(selectedDates.map((value) => Number(value)))]
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
        .sort((left, right) => left - right);

      const days = dayOfWeeks
        .map((dayOfWeek) => {
          const dayId = sushkaMenuIdByDay[dayOfWeek];
          if (!dayId) {
            return null;
          }

          const isSushkaXS = pkg === "Sushka XS";
          const limit = isSushkaXS ? 3 : 4;

          const sushkaSelections: Record<string, number> = {
            breakfast: 0,
            lunch: 0,
            dinner: 0,
          };
          if (!isSushkaXS) {
            sushkaSelections.snack = 0;
          }

          return {
            dayId,
            selectedCount: limit,
            selections: sushkaSelections,
          };
        })
        .filter((day): day is NonNullable<typeof day> => day !== null);

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
      .filter((day) => isDaySelectionComplete(day.selectedCount, pkg));

    return {
      days,
      packageLimit,
      packageType: pkg,
      totalDays: days.length,
    };
  }, [packageLimit, pkg, selectedDates, selectedPackageRaw, selections, sushkaMenuIdByDay]);

  const orderTotalUah = useMemo(() => {
    if (!pkg) {
      return 0;
    }

    if (pkg === "Sushka XS" || pkg === "Sushka S") {
      return PACKAGE_PRICES[pkg] * cartData.totalDays;
    }

    if (pkg === "Sushka") {
      return 0;
    }

    return getOrderTotalUah(pkg, cartData.totalDays);
  }, [cartData.totalDays, pkg]);

  const deliveryDate = useMemo(
    () => earliestMenuDeliveryDateFromCartDays(cartData.days, menuDayByItemId),
    [cartData.days, menuDayByItemId],
  );

  const summaryDays = useMemo<SummaryDay[]>(() => {
    const referenceDate = new Date();

    return cartData.days
      .map((day) => {
        const dayOfWeek = menuDayByItemId[day.dayId];
        if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
          return null;
        }

        const date = dateForMenuDayOfWeek(dayOfWeek, referenceDate);

        return {
          dayId: day.dayId,
          dayName: dayNames[dayOfWeek] || `День ${dayOfWeek}`,
          dayOfWeek,
          scheduleLabel: formatScheduleDayLabel(date),
        };
      })
      .filter((day): day is SummaryDay => day !== null)
      .sort((left, right) => left.dayOfWeek - right.dayOfWeek);
  }, [cartData.days, menuDayByItemId]);

  const incompleteDaysCount = useMemo(() => {
    if (!pkg || pkg.includes("Sushka")) {
      return 0;
    }

    return Object.values(selections).filter((daySelections) => {
      const selectedCount = getDaySelectedCount(daySelections, pkg);
      return selectedCount > 0 && !isDaySelectionComplete(selectedCount, pkg);
    }).length;
  }, [pkg, selections]);

  const formKey = useMemo(
    () =>
      [
        customerProfile.userId,
        customerProfile.name,
        customerProfile.phone,
        customerProfile.address,
        customerProfile.cutlery,
        customerProfile.deliveryTime,
        customerProfile.notes,
      ].join("|"),
    [customerProfile],
  );

  const handleRemoveDay = (day: SummaryDay) => {
    if (cartData.packageType.includes("Sushka")) {
      setSelectedDates(selectedDates.filter((value) => Number(value) !== day.dayOfWeek));
      return;
    }

    clearDaySelections(day.dayId);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const submittedValues = parseCheckoutFormData(formData);
    const nextFieldErrors = validateCheckoutFormValues(submittedValues);

    if (!pkg) {
      nextFieldErrors.cart = "Спочатку оберіть тариф і збережіть кошик на сторінці меню.";
    } else if (cartData.totalDays === 0) {
      nextFieldErrors.cart = pkg.includes("Sushka")
        ? "Для Сушки оберіть хоча б один день доставки."
        : "Додайте хоча б один повністю зібраний день до замовлення.";
    } else {
      const indivPackage = isIndivPackage(selectedPackageRaw ?? undefined);
      const serverPackageLimit = getPackageLimit(pkg);

      for (const day of cartData.days) {
        if (indivPackage) {
          if (!day.items) {
            nextFieldErrors.cart = "Для тарифу Indiv перевірте склад кожного дня.";
            break;
          }

          const totalQuantity = day.items.reduce((sum, item) => sum + item.quantity, 0);
          if (totalQuantity < 1 || totalQuantity > 10) {
            nextFieldErrors.cart = "Для тарифу Indiv кожен день повинен містити від 1 до 10 страв.";
            break;
          }

          const hasInvalidQuantity = day.items.some((item) => item.quantity > 3);
          if (hasInvalidQuantity) {
            nextFieldErrors.cart = "Для тарифу Indiv максимум 3 однакові страви на день.";
            break;
          }
        } else if (!pkg.includes("Sushka") && day.selectedCount !== serverPackageLimit) {
          nextFieldErrors.cart =
            `Для тарифу ${pkg} кожен день повинен містити рівно ${serverPackageLimit} страв.`;
          break;
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
          message: "Не вдалося визначити дату доставки за вибраними днями.",
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
        deliveryDateLabel: formatDisplayDate(deliveryDate),
        packageType: cartData.packageType,
        totalDays: cartData.totalDays,
        totalPrice: orderTotalUah,
      });

      setCustomerProfile({
        address: submittedValues.address,
        cutlery: submittedValues.cutlery,
        deliveryTime: submittedValues.deliveryTime,
        name: submittedValues.name,
        notes: submittedValues.comment,
        phone: submittedValues.phone,
        userId: result.userId,
      });

      clearSelections();
      resetWizard();
    });
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-10 text-slate-900 md:px-8">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-600">
              ✓
            </div>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">
              Замовлення прийнято
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
              {isIndivPackage(submitted.packageType) ? "Заявку прийнято" : "Дякуємо за замовлення"}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600">
              {isIndivPackage(submitted.packageType)
                ? "Вашу заявку прийнято! З вами найближчим часом зв'яжеться оператор для погодження меню та кінцевої вартості."
                : "Ми вже зберегли ваше замовлення в системі. Найближчим часом менеджер зв'яжеться з вами для підтвердження деталей доставки."}
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 px-5 py-4 text-left">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Тариф</div>
              <div className="mt-2 text-lg font-bold text-slate-900">{submitted.packageType}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4 text-left">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Днів</div>
              <div className="mt-2 text-lg font-bold text-slate-900">{submitted.totalDays}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4 text-left">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Сума</div>
              <div className="mt-2 text-lg font-bold text-slate-900">
                {isIndivPackage(submitted.packageType) ? (
                  "—"
                ) : submitted.totalPrice > 0 ? (
                  `${submitted.totalPrice} ₴`
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>

          {submitted.deliveryDateLabel && (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
              Перша доставка запланована на <span className="font-semibold">{submitted.deliveryDateLabel}</span>.
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-6 py-4 text-base font-bold text-white transition-all duration-200 ease-out hover:bg-emerald-600 active:scale-95 shadow-sm hover:shadow-md"
            >
              Повернутися до меню
            </Link>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-4 text-base font-bold text-gray-700 transition-all duration-200 ease-out hover:bg-gray-50 active:scale-95"
            >
              Перейти до профілю
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-h-screen bg-slate-50/50 px-4 py-10 text-slate-900 md:px-8">
      <section className="flex-grow mx-auto w-full max-w-6xl pb-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700 active:scale-95"
        >
          <span>←</span>
          <span>Повернутися до меню</span>
        </Link>

        <div className="mt-5 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">Checkout</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Завершення замовлення
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Перевірте обрані дні, залиште контакти та підтвердьте замовлення. Кошик зберігається окремо,
            тому ви можете повернутися до меню й відредагувати його без втрати даних.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <aside className="h-fit rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-8 lg:sticky lg:top-24">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Підсумок
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Ваше замовлення</h2>
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Днів</div>
                <div className="mt-1 text-2xl font-black text-slate-950">{cartData.totalDays}</div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-slate-950 px-5 py-5 text-white">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-300">Тариф</span>
                <span className="text-sm font-semibold text-white">{selectedPackageRaw ?? "—"}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-300">До сплати</span>
                <span className={`${isIndivPackage(selectedPackageRaw ?? undefined) ? "text-xl" : "text-3xl"} font-black text-white`}>
                  {isIndivPackage(selectedPackageRaw ?? undefined) ? (
                    "Індивідуальний розрахунок"
                  ) : orderTotalUah > 0 ? (
                    `${orderTotalUah} ₴`
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <span className="text-sm text-slate-300">Перша доставка</span>
                <span className="text-right text-sm font-semibold text-white">
                  {deliveryDate ? formatDisplayDate(deliveryDate) : "—"}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Обрані дні
                </h3>
                {summaryDays.length > 0 && (
                  <span className="text-xs font-medium text-slate-500">{summaryDays.length} позицій</span>
                )}
              </div>

              {summaryDays.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                  Поки що немає повністю зібраних днів. Поверніться до меню та додайте хоча б один день.
                </div>
              ) : (
                <ul className="space-y-3">
                  {summaryDays.map((day) => (
                    <li
                      key={day.dayId}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-slate-900">
                            {day.dayName} - {cartData.packageType}
                          </p>
                          <p className="mt-1 break-words text-sm text-slate-500">{day.scheduleLabel}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDay(day)}
                          className="inline-flex shrink-0 items-center self-start rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 active:scale-95"
                        >
                          Видалити
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {incompleteDaysCount > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Неповністю зібрані дні не потраплять у замовлення. Зараз таких днів: {incompleteDaysCount}.
              </div>
            )}
          </aside>

          <section className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Контактні дані</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Куди і кому доставляти</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Telegram-авторизація необов&apos;язкова, але допоможе швидше підтягнути ваші дані.
              </p>
            </div>

            {!customerProfile.isAuthenticated && (
              <div className="mb-6 rounded-3xl border border-dashed border-emerald-200 bg-emerald-50 px-5 py-5">
                <TelegramDeepLinkAuth />
              </div>
            )}

            {feedback && (
              <div
                className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
                  feedback.tone === "success"
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {feedback.message}
              </div>
            )}

            {fieldErrors.cart && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {fieldErrors.cart}
              </div>
            )}

            <form key={formKey} className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2 md:gap-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-900">Ім&apos;я</span>
                  <input
                    aria-invalid={fieldErrors.name ? "true" : "false"}
                    autoComplete="name"
                    className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                      fieldErrors.name
                        ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-100"
                    }`}
                    defaultValue={customerProfile.name ?? ""}
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
                  <span className="mb-2 block text-sm font-semibold text-slate-900">Телефон</span>
                  <input
                    aria-invalid={fieldErrors.phone ? "true" : "false"}
                    autoComplete="tel"
                    className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                      fieldErrors.phone
                        ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-100"
                    }`}
                    defaultValue={normalizedPhone}
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

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-900">Адреса доставки</span>
                <textarea
                  aria-invalid={fieldErrors.address ? "true" : "false"}
                  autoComplete="street-address"
                  className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                    fieldErrors.address
                      ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                      : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-100"
                  }`}
                  defaultValue={customerProfile.address ?? ""}
                  name="address"
                  placeholder="Вулиця, будинок, квартира, під’їзд, орієнтир"
                  required
                  rows={3}
                />
                {fieldErrors.address && (
                  <span className="mt-2 block text-sm text-red-600">{fieldErrors.address}</span>
                )}
              </label>

              <div className="grid gap-4 md:grid-cols-2 md:gap-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-900">
                    Кількість приборів
                  </span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={String(customerProfile.cutlery ?? 0)}
                    name="cutlery"
                  >
                    {CUTLERY_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-900">
                    Бажаний час доставки
                  </span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    defaultValue={normalizedDeliveryTime}
                    name="deliveryTime"
                  >
                    <option value="">Не вказано</option>
                    {DELIVERY_TIME_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-900">Коментар до замовлення</span>
                <textarea
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  defaultValue={customerProfile.notes ?? ""}
                  name="comment"
                  placeholder="Побажання, деталі для курʼєра або зручний орієнтир"
                  rows={4}
                />
              </label>

              <div className="rounded-3xl bg-slate-50 px-5 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {isIndivPackage(selectedPackageRaw ?? undefined)
                        ? "Індивідуальний розрахунок"
                        : `До підтвердження: ${orderTotalUah} ₴`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Натискаючи кнопку, ви передаєте замовлення менеджеру в обробку.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={isPending || cartData.totalDays === 0}
                    className={`inline-flex w-full items-center justify-center rounded-2xl px-6 py-4 text-base font-bold transition-all duration-200 ease-out active:scale-95 sm:w-full ${
                      isPending || cartData.totalDays === 0
                        ? "cursor-not-allowed bg-slate-200 text-slate-400"
                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg"
                    }`}
                  >
                    {isPending
                      ? "Надсилаємо..."
                      : isIndivPackage(selectedPackageRaw ?? undefined)
                      ? "Надіслати заявку"
                      : "Підтвердити замовлення"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
