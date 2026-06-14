"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  formatDisplayDate,
  formatScheduleDayLabel,
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
import { checkoutSchema, type CheckoutSchema } from "@/lib/validations";

type FeedbackState = {
  message: string;
  tone: "error" | "success";
};

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
  const [submitted, setSubmitted] = useState<SubmittedState | null>(null);
  const [availableDays, setAvailableDays] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">("card");
  const [isPending, startTransition] = useTransition();
  const normalizedPhone = sanitizeTelegramPhone(customerProfile.phone);

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors },
    reset,
  } = useForm<CheckoutSchema>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: customerProfile.name,
      phone: normalizedPhone,
      address: customerProfile.address,
      comment: customerProfile.notes || "",
      cutlery: customerProfile.cutlery,
      paymentMethod: "balance",
    },
  });

  useEffect(() => {
    reset({
      name: customerProfile.name,
      phone: normalizedPhone,
      address: customerProfile.address,
      comment: customerProfile.notes || "",
      cutlery: customerProfile.cutlery,
      paymentMethod,
    });
  }, [customerProfile, normalizedPhone, paymentMethod, reset]);

  useEffect(() => {
    if (!pkg) return;
    
    fetch(`/api/balance?packageId=${pkg}`)
      .then(res => res.json())
      .then(data => {
        if (typeof data.availableDays === 'number') {
          setAvailableDays(data.availableDays);
        }
      })
      .catch(err => console.error("Balance fetch error:", err));
  }, [pkg]);

  useEffect(() => {
    if (!authenticatedUser || customerProfile.isAuthenticated) {
      return;
    }

    setCustomerProfile({
      address: authenticatedUser.address || "",
      cutlery: authenticatedUser.defaultCutlery || 0,
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

  const packageLimitInfo = getPackageLimit(pkg ?? undefined);

  const isCustomMode = useOrderStore((state) => state.isCustomMode);

  const cartData = useMemo<OrderCartData>(() => {
    if (!pkg) {
      return {
        days: [],
        packageLimit: getPackageLimit().limit,
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
        packageLimit: packageLimitInfo.limit,
        packageType: pkg,
        totalDays: days.length,
      };
    }

    const days = Object.entries(selections)
      .map(([dayId, daySelections]) => {
        const selectedCount = getDaySelectedCount(daySelections, pkg);
        const isCustom = isIndivPackage(selectedPackageRaw ?? undefined) || isCustomMode;

        if (isCustom) {
          return {
            dayId,
            isCustomMode: isCustomMode,
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
      packageLimit: packageLimitInfo.limit,
      packageType: pkg,
      totalDays: days.length,
    };
  }, [packageLimitInfo.limit, pkg, selectedDates, selectedPackageRaw, selections, sushkaMenuIdByDay, isCustomMode]);

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

  const { balanceDaysToUse, fiatPrice } = useMemo(() => {
    if (!pkg || availableDays === 0) {
      return { balanceDaysToUse: 0, fiatPrice: orderTotalUah };
    }
    
    const toUse = Math.min(availableDays, cartData.totalDays);
    const fiatDays = cartData.totalDays - toUse;
    
    let fPrice = 0;
    if (fiatDays > 0) {
      if (!pkg.includes("Sushka")) {
        fPrice = getOrderTotalUah(pkg, fiatDays);
      } else {
        // Calculate daily price from the full total for sushka
        const dailyPrice = cartData.totalDays > 0 ? Math.round(orderTotalUah / cartData.totalDays) : 0;
        fPrice = dailyPrice * fiatDays;
      }
    }
    
    return { balanceDaysToUse: toUse, fiatPrice: fPrice };
  }, [availableDays, cartData.totalDays, orderTotalUah, pkg]);

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

  const onValidSubmit = (data: CheckoutSchema) => {
    if (!pkg) {
      setFeedback({ message: "Спочатку оберіть тариф.", tone: "error" });
      return;
    }
    if (cartData.totalDays === 0) {
      setFeedback({ message: "Додайте хоча б один день до замовлення.", tone: "error" });
      return;
    }

    const indivPackage = isIndivPackage(selectedPackageRaw ?? undefined);
    const serverPackageLimit = getPackageLimit(pkg);

    for (const day of cartData.days) {
      if (indivPackage) {
        if (!day.items) return;
        const totalQuantity = day.items.reduce((sum, item) => sum + item.quantity, 0);
        if (totalQuantity < 1 || totalQuantity > 10) return;
      } else if (!pkg.includes("Sushka") && day.selectedCount !== serverPackageLimit.limit) {
        return;
      }
    }

    setFeedback(null);

    startTransition(async () => {
      if (!deliveryDate) {
        setFeedback({
          message: "Не вдалося визначити дату доставки за вибраними днями.",
          tone: "error",
        });
        return;
      }

      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      // Override paymentMethod based on fiatPrice
      if (fiatPrice === 0) {
        formData.set("paymentMethod", "balance");
      } else {
        formData.set("paymentMethod", paymentMethod);
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
        totalPrice: fiatPrice,
      });

      setCustomerProfile({
        address: data.address,
        cutlery: data.cutlery,
        name: data.name,
        notes: data.comment,
        phone: data.phone,
        userId: result.userId,
      });

      clearSelections();
      resetWizard();
    });
  };

  if (submitted) {
    return (
      <main className="min-h-[100dvh] bg-gray-50 px-4 py-10 text-slate-900 md:px-8">
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
    <main className="flex-1 flex flex-col min-h-[100dvh] bg-slate-50/50 px-4 py-10 text-slate-900 md:px-8">
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
                <div className="mt-4 rounded-xl bg-emerald-500/20 p-3 text-xs font-semibold text-emerald-200 border border-emerald-500/30">
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
                Telegram-авторизація допоможе швидше підтягнути ваші дані та отримати доступ до абонементів.
              </p>
            </div>

            {!customerProfile.isAuthenticated && (
              <div className="mb-8 rounded-[2rem] border-2 border-red-200 bg-red-50 p-6 shadow-sm">
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

            <div className="mb-8 rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Спосіб оплати</h3>
              
              {fiatPrice === 0 ? (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
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
                    onClick={() => setPaymentMethod("card")}
                    className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition-all ${
                      paymentMethod === "card"
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-bold text-slate-900">Карткою онлайн</div>
                      <div className="text-xs text-slate-500">Apple Pay, Google Pay, Visa/MC</div>
                    </div>
                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                      paymentMethod === "card" ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                    }`}>
                      {paymentMethod === "card" && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition-all ${
                      paymentMethod === "cash"
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-bold text-slate-900">Готівкою</div>
                      <div className="text-xs text-slate-500">При отриманні кур&apos;єру</div>
                    </div>
                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                      paymentMethod === "cash" ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                    }`}>
                      {paymentMethod === "cash" && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                  </button>
                </div>
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
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {feedback.message}
              </div>
            )}

            <form key={formKey} className="space-y-6" onSubmit={handleFormSubmit(onValidSubmit)}>
              <div className="grid gap-4 md:grid-cols-2 md:gap-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-900">Ім&apos;я</span>
                  <input
                    {...register("name")}
                    aria-invalid={errors.name ? "true" : "false"}
                    autoComplete="name"
                    className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                      errors.name
                        ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-100"
                    }`}
                    placeholder="Як до вас звертатися"
                    type="text"
                  />
                  {errors.name && (
                    <span className="mt-2 block text-sm text-red-600">{errors.name.message}</span>
                  )}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-900">Телефон</span>
                  <input
                    {...register("phone")}
                    aria-invalid={errors.phone ? "true" : "false"}
                    autoComplete="tel"
                    className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                      errors.phone
                        ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-100"
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
                <span className="mb-2 block text-sm font-semibold text-slate-900">Адреса доставки</span>
                <textarea
                  {...register("address")}
                  aria-invalid={errors.address ? "true" : "false"}
                  autoComplete="street-address"
                  className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-4 ${
                    errors.address
                      ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                      : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-100"
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
                  <span className="mb-2 block text-sm font-semibold text-slate-900">
                    Кількість приборів
                  </span>
                  <select
                    {...register("cutlery", { valueAsNumber: true })}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
                <span className="mb-2 block text-sm font-semibold text-slate-900">Коментар до замовлення</span>
                <textarea
                  {...register("comment")}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
        </div>
      </section>
    </main>
  );
}
