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
            замовленні: <span className="font-semibold text-gray-900">{submitted.totalDays}</span>. Доставка
            кур&apos;єром за вказаною адресою.
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
              <div className="mt-4">
                <TelegramDeepLinkAuth />
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

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-900">Крок 1. Ім&apos;я</span>
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
                <span className="mb-2 block text-sm font-semibold text-gray-900">Крок 1. Телефон</span>
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
