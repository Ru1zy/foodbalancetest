"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { CheckoutSuccessView } from "@/components/checkout/CheckoutSuccessView";
import { CheckoutSummaryAside } from "@/components/checkout/CheckoutSummaryAside";
import { CheckoutCustomerForm } from "@/components/checkout/CheckoutCustomerForm";
import type { SubmittedState, SummaryDay } from "@/components/checkout/types";
import { zodResolver } from "@hookform/resolvers/zod";
import TelegramDeepLinkAuth from "@/components/TelegramDeepLinkAuth";
import {
  submitOrders,
  type CartOrderInput,
  type OrderCartData,
} from "@/app/actions/order-impl";
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
  hasIndivSelections,
  isDaySelectionComplete,
  isIndivPackage,
  toIndivDishQuantities,
} from "@/lib/order-selection";
import { parsePackageType } from "@/lib/package-coerce";
import { useOrderStore, type CartItem } from "@/lib/orderStore";
import { isTelegramPlaceholderPhone, sanitizeTelegramPhone } from "@/lib/telegram-phone";
import { checkoutSchema, type CheckoutSchema } from "@/lib/validations";

type FeedbackState = {
  message: string;
  tone: "error" | "success";
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
  tariffs?: { name: string; basePrice: number }[];
};

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
  tariffs,
}: Props) {
  const router = useRouter();
  const customerProfile = useOrderStore((state) => state.customerProfile);
  const selectedPackageRaw = useOrderStore((state) => state.selectedPackage);
  const selectedDates = useOrderStore((state) => state.selectedDates);
  const selections = useOrderStore((state) => state.selections);
  const clearSelections = useOrderStore((state) => state.clearSelections);
  const clearDaySelections = useOrderStore((state) => state.clearDaySelections);
  const resetWizard = useOrderStore((state) => state.resetWizard);
  const setCustomerProfile = useOrderStore((state) => state.setCustomerProfile);
  const setSelectedDates = useOrderStore((state) => state.setSelectedDates);
  const cartItems = useOrderStore((state) => state.cartItems);
  const addCartItem = useOrderStore((state) => state.addCartItem);
  const removeCartItem = useOrderStore((state) => state.removeCartItem);
  const incrementQuantity = useOrderStore((state) => state.incrementQuantity);
  const decrementQuantity = useOrderStore((state) => state.decrementQuantity);
  const clearCart = useOrderStore((state) => state.clearCart);
  const pkg = parsePackageType(selectedPackageRaw);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedState | null>(null);
  const [availableDays, setAvailableDays] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"plata" | "cash">("plata");
  const [isPending, startTransition] = useTransition();
  const normalizedPhone = sanitizeTelegramPhone(customerProfile.phone);
  // Stable idempotency key for this checkout session — prevents duplicate orders
  // and double balance charges on network retries / double clicks. Regenerated
  // after a successful submit so the next order gets a fresh key.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  const methods = useForm<CheckoutSchema>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: customerProfile.name,
      phone: normalizedPhone,
      address: customerProfile.address,
      comment: customerProfile.notes || "",
      cutlery: customerProfile.cutlery,
      paymentMethod: "balance",
      sendEmailReceipt: false,
      receiptEmail: "",
    },
  });

  // Preserve email state when payment method changes
  useEffect(() => {
    const currentValues = methods.getValues();
    methods.reset({
      name: customerProfile.name,
      phone: normalizedPhone,
      address: customerProfile.address,
      comment: customerProfile.notes || "",
      cutlery: customerProfile.cutlery,
      paymentMethod,
      sendEmailReceipt: currentValues.sendEmailReceipt ?? false,
      receiptEmail: currentValues.receiptEmail || "",
    });
  }, [customerProfile, normalizedPhone, paymentMethod, methods]);

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
    if (authenticatedUser && !customerProfile.isAuthenticated) {
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
    } else if (!authenticatedUser && customerProfile.isAuthenticated) {
      setCustomerProfile({ isAuthenticated: false });
    }
  }, [authenticatedUser, customerProfile.isAuthenticated, setCustomerProfile]);

  useEffect(() => {
    if (!isTelegramPlaceholderPhone(customerProfile.phone)) {
      return;
    }

    setCustomerProfile({ phone: "" });
  }, [customerProfile.phone, setCustomerProfile]);

  const packageLimitInfo = getPackageLimit(pkg ?? undefined);

  const customModeDays = useOrderStore((state) => state.customModeDays);

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
        // Custom mode is resolved PER DAY: Indiv tariff, this day's explicit
        // toggle, or portion-shaped selection keys all mark the day individual.
        const isCustom =
          isIndivPackage(selectedPackageRaw ?? undefined) ||
          !!customModeDays[dayId] ||
          hasIndivSelections(daySelections);

        if (isCustom) {
          return {
            dayId,
            isCustomMode: true,
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
  }, [packageLimitInfo.limit, pkg, selectedDates, selectedPackageRaw, selections, sushkaMenuIdByDay, customModeDays]);

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

    return getOrderTotalUah(pkg, cartData.totalDays, tariffs);
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
        fPrice = getOrderTotalUah(pkg, fiatDays, tariffs);
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

  // ── Multi-order cart derived state ───────────────────────────────────────
  const isIndivCurrent = isIndivPackage(selectedPackageRaw ?? undefined);
  const currentDraftValid = Boolean(pkg) && cartData.totalDays > 0;

  /** Sum of fiat subtotals for added cart packages (Indiv items are operator-priced → excluded). */
  const cartFiatTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) =>
          sum + (isIndivPackage(item.packageType) ? 0 : item.unitPrice * item.quantity),
        0,
      ),
    [cartItems],
  );

  const hasIndivInCart = useMemo(
    () => cartItems.some((item) => isIndivPackage(item.packageType)),
    [cartItems],
  );

  const cartCopiesCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  /** Gross total across the current draft + all added packages (excludes Indiv). */
  const grandGrossTotal =
    (isIndivCurrent ? 0 : currentDraftValid ? orderTotalUah : 0) + cartFiatTotal;

  /** Snapshot the current wizard draft as a ready-to-submit cart item. */
  const buildDraftCartItem = (): CartItem | null => {
    if (!pkg || cartData.totalDays === 0 || !deliveryDate) {
      return null;
    }
    return {
      id: `${pkg}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      packageType: pkg,
      packageLabel: selectedPackageRaw ?? pkg,
      cartData,
      deliveryDate: deliveryDate.toISOString(),
      unitPrice: orderTotalUah,
      dayCount: cartData.totalDays,
      dayLabels: summaryDays.map((day) => `${day.dayName} (${day.scheduleLabel})`),
      quantity: 1,
    };
  };

  /**
   * "Add another package": commit the current draft into the cart (so it is not
   * lost), then reset the wizard and return to its start. The cart itself is
   * persisted in the store and is intentionally NOT cleared.
   */
  const handleAddAnotherPackage = () => {
    const draft = buildDraftCartItem();
    if (draft) {
      addCartItem(draft);
    }
    clearSelections();
    resetWizard();
    router.push("/");
  };

  const handleRemoveDay = (day: SummaryDay) => {
    if (cartData.packageType.includes("Sushka")) {
      setSelectedDates(selectedDates.filter((value) => Number(value) !== day.dayOfWeek));
      return;
    }

    clearDaySelections(day.dayId);
  };

  const onValidSubmit = (data: CheckoutSchema) => {
    const hasDraft = currentDraftValid;
    const hasCartItems = cartItems.length > 0;

    if (!hasDraft && !hasCartItems) {
      setFeedback({ message: "Додайте хоча б один раціон до замовлення.", tone: "error" });
      return;
    }

    // Validate the current draft (if present) the same way as before.
    if (hasDraft && pkg) {
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

      if (!deliveryDate) {
        setFeedback({
          message: "Не вдалося визначити дату доставки за вибраними днями.",
          tone: "error",
        });
        return;
      }
    }

    setFeedback(null);

    startTransition(async () => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
      // The server applies balance per individual order, so always pass the
      // user's chosen fiat method; balance-covered orders resolve to 0 ₴ there.
      formData.set("paymentMethod", paymentMethod);

      // Build the order list: previously added packages + the current draft.
      const items: CartOrderInput[] = cartItems.map((item) => ({
        cartData: item.cartData,
        deliveryDate: item.deliveryDate,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      }));

      if (hasDraft && deliveryDate) {
        items.push({
          cartData,
          deliveryDate: deliveryDate.toISOString(),
          unitPrice: orderTotalUah,
          quantity: 1,
        });
      }

      const result = await submitOrders(formData, items, idempotencyKey);
      if (!result.ok) {
        setFeedback({
          message: result.message,
          tone: "error",
        });
        return;
      }

      const totalDays =
        cartItems.reduce((sum, item) => sum + item.dayCount * item.quantity, 0) +
        (hasDraft ? cartData.totalDays : 0);

      const firstDeliveryLabel = deliveryDate
        ? formatDisplayDate(deliveryDate)
        : cartItems[0]
        ? formatDisplayDate(new Date(cartItems[0].deliveryDate))
        : null;

      setSubmitted({
        deliveryDateLabel: firstDeliveryLabel,
        packageType: result.orderCount > 1 ? "Декілька раціонів" : cartData.packageType,
        totalDays,
        totalPrice: grandGrossTotal,
        orderCount: result.orderCount,
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
      clearCart();
      // Fresh key for any subsequent order in this session.
      setIdempotencyKey(crypto.randomUUID());
    });
  };

  if (submitted) {
    return <CheckoutSuccessView submitted={submitted} />;
  }

  return (
    <FormProvider {...methods}>
      <main className="flex-1 flex flex-col min-h-[100dvh] bg-transparent dark:bg-slate-950/50 px-4 py-10 text-slate-900 dark:text-slate-100 md:px-8">
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
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">
              Завершення замовлення
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Перевірте обрані дні, залиште контакти та підтвердьте замовлення. Кошик зберігається окремо,
              тому ви можете повернутися до меню й відредагувати його без втрати даних.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <CheckoutSummaryAside
              isAuthenticated={customerProfile.isAuthenticated}
              cartData={cartData}
              selectedPackageRaw={selectedPackageRaw}
              fiatPrice={fiatPrice}
              balanceDaysToUse={balanceDaysToUse}
              deliveryDate={deliveryDate}
              cartItems={cartItems}
              cartCopiesCount={cartCopiesCount}
              grandGrossTotal={grandGrossTotal}
              hasIndivInCart={hasIndivInCart}
              isIndivCurrent={isIndivCurrent}
              summaryDays={summaryDays}
              incompleteDaysCount={incompleteDaysCount}
              currentDraftValid={currentDraftValid}
              availableDays={availableDays}
              paymentMethod={paymentMethod}
              handleAddAnotherPackage={handleAddAnotherPackage}
              handleRemoveDay={handleRemoveDay}
              removeCartItem={removeCartItem}
              decrementQuantity={decrementQuantity}
              incrementQuantity={incrementQuantity}
            />

            <CheckoutCustomerForm
              isAuthenticated={customerProfile.isAuthenticated}
              fiatPrice={fiatPrice}
              balanceDaysToUse={balanceDaysToUse}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              cartItems={cartItems}
              grandGrossTotal={grandGrossTotal}
              hasIndivInCart={hasIndivInCart}
              isIndivCurrent={isIndivCurrent}
              orderTotalUah={orderTotalUah}
              selectedPackageRaw={selectedPackageRaw}
              isPending={isPending}
              cartTotalDays={cartData.totalDays}
              onValidSubmit={onValidSubmit}
              feedback={feedback}
            />
          </div>
        </section>
      </main>
    </FormProvider>
  );
}
