"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { Order, Prisma, User } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  earliestMenuDeliveryDateFromCartDays,
  getOrderTotalUah,
  getPackageLimit,
  PackageType,
} from "@/lib/order-logic";
import { kyivCalendarDateKey } from "@/lib/checkout";
import { verifyAuthToken } from "@/lib/auth-token";
import { isIndivPackage, type IndivDishQuantity } from "@/lib/order-selection";
import { sendOrderNotification } from "@/lib/telegram";
import { checkoutSchema } from "@/lib/validations";
import { syncClientToSheet, appendOrderToSheet } from "@/lib/googleSheets";
import { isGooglePlaceholderPhone } from "@/lib/google-auth";
import { normalizePhone } from "@/lib/phone-utils";

export type StandardSelections = Record<string, number>;

export type OrderCartDay = {
  dayId: string;
  items?: IndivDishQuantity[];
  selectedCount: number;
  selections?: StandardSelections;
  isCustomMode?: boolean;
};

export type OrderCartData = {
  days: OrderCartDay[];
  packageLimit: number;
  packageType: PackageType;
  totalDays: number;
};

export type SubmitOrderResult =
  | {
      ok: true;
      orderId: string;
      userId: string;
    }
  | {
      message: string;
      ok: false;
      status: number;
    };

/** One assembled package coming from the multi-order cart. */
export type CartOrderInput = {
  cartData: OrderCartData;
  deliveryDate: Date | string;
  unitPrice: number;
  /** How many identical copies of this package to create. */
  quantity: number;
};

export type SubmitOrdersResult =
  | {
      ok: true;
      orderIds: string[];
      orderCount: number;
      userId: string;
    }
  | {
      message: string;
      ok: false;
      status: number;
      /**
       * Orders persisted before the failure. The batch is fully transactional,
       * so this is always 0 — either every order commits or none do.
       */
      createdCount: number;
    };

/** Hard ceiling on copies of a single package (mirrors orderStore). */
const MAX_CART_ITEM_QUANTITY = 50;

/** The validated checkout payload (output of the zod schema). */
type CheckoutData = ReturnType<typeof checkoutSchema.parse>;

/**
 * A fully validated, DB-ready order. Everything in here has already passed
 * validation and the (read-only) delivery-date / menu checks, so persisting it
 * only requires the write queries inside the transaction.
 */
type PreparedOrder = {
  validatedData: CheckoutData;
  sanitizedCartData: OrderCartData;
  resolvedDeliveryDate: Date;
  paymentMethod: CheckoutData["paymentMethod"];
  totalPrice: number;
};

function sanitizeCartData(cartData: OrderCartData): OrderCartData {
  // CRITICAL: Calculate server-side package limit - NEVER trust client's packageLimit
  const { limit: serverPackageLimit, exact } = getPackageLimit(cartData.packageType);

  // Validate that client-provided limit matches server calculation
  if (cartData.packageLimit !== serverPackageLimit) {
    throw new Error(
      `Package limit mismatch: client sent ${cartData.packageLimit}, server expects ${serverPackageLimit} for ${cartData.packageType}`
    );
  }

  // For Sushka packages (XS and S), bypass strict dish selection validation
  if (cartData.packageType.includes("Sushka")) {
    const isSushkaXS = cartData.packageType === "Sushka XS";
    const limit = isSushkaXS ? 3 : 4;

    const days = (Array.isArray(cartData.days) ? cartData.days : [])
      .filter((day) => day && typeof day.dayId === "string" && (day.dayId || '').trim().length > 0)
      .map((day) => {
        const selections: StandardSelections = {
          breakfast: 0,
          lunch: 0,
          dinner: 0,
        };
        if (!isSushkaXS) {
          selections.snack = 0;
        }

        return {
          dayId: (day.dayId || '').trim(),
          selectedCount: limit,
          selections,
        };
      });

    return {
      days,
      packageLimit: serverPackageLimit,
      packageType: cartData.packageType,
      totalDays: days.length,
    };
  }

  const indivPackage = isIndivPackage(cartData.packageType);
  const days = Array.isArray(cartData.days)
    ? cartData.days.filter((day) => {
        if (!day || typeof day.dayId !== "string" || !(day.dayId || '').trim()) {
          return false;
        }

        const isCustom = indivPackage || day.isCustomMode;

        if (isCustom) {
          if (!Array.isArray(day.items)) {
            return false;
          }

          const normalizedItems = day.items.filter(
            (item) =>
              !!item &&
              typeof item.dishId === "string" &&
              (item.dishId || '').trim().length > 0 &&
              Number.isInteger(item.quantity) &&
              item.quantity > 0,
          );

          const totalQuantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);

          // Validation logic based on 'exact' flag
          if (exact) {
            if (totalQuantity !== serverPackageLimit) return false;
          } else {
            // Non-exact (Indiv): min 1, max serverPackageLimit
            if (totalQuantity < 1 || totalQuantity > serverPackageLimit) return false;
          }

          // Max 3 of same dish only for Indiv package
          if (indivPackage && normalizedItems.some(item => item.quantity > 3)) {
             return false;
          }

          return day.selectedCount === totalQuantity;
        }

        if (!day.selections || typeof day.selections !== "object" || Array.isArray(day.selections)) {
          return false;
        }

        const normalizedSelections = Object.entries(day.selections).filter(
          ([category, index]) => (category || '').trim().length > 0 && Number.isInteger(index) && index >= 0,
        );

        // For non-Indiv packages: must match exact server-calculated package limit
        return normalizedSelections.length === serverPackageLimit && day.selectedCount === serverPackageLimit;
      })
    : [];

  return {
    days: days.map((day) => {
      const isCustom = indivPackage || day.isCustomMode;
      if (isCustom) {
        return {
          dayId: day.dayId,
          isCustomMode: day.isCustomMode,
          items: (day.items ?? [])
            .filter(
              (item) =>
                typeof item.dishId === "string" &&
                (item.dishId || '').trim().length > 0 &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0,
            )
            .map((item) => ({
              dishId: item.dishId,
              quantity: item.quantity,
            })),
          selectedCount: day.selectedCount,
        };
      }

      return {
        dayId: day.dayId,
        selectedCount: day.selectedCount,
        selections: day.selections ?? {},
      };
    }),
    packageLimit: serverPackageLimit, // Use server-calculated limit, not client's
    packageType: cartData.packageType,
    totalDays: days.length,
  };
}

async function resolveServerDeliveryDate(sanitizedCartData: OrderCartData): Promise<Date | null> {
  const uniqueIds = [...new Set(sanitizedCartData.days.map((d) => d.dayId))];
  if (uniqueIds.length === 0) {
    return null;
  }

  const rows = await prisma.menu.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, dayOfWeek: true },
  });

  if (rows.length !== uniqueIds.length) {
    return null;
  }

  const menuDayByItemId = Object.fromEntries(rows.map((r: { id: string; dayOfWeek: number }) => [r.id, r.dayOfWeek]));
  return earliestMenuDeliveryDateFromCartDays(sanitizedCartData.days, menuDayByItemId, new Date());
}

function normalizeDeliveryDateInput(value: Date | string): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Resolve the authenticated user once from the auth cookie (read-only). */
async function resolveAuthenticatedUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth_token")?.value;
  if (!authToken) {
    return null;
  }

  try {
    return await verifyAuthToken(authToken);
  } catch (authError) {
    console.error("auth token verification failed", authError);
    return null;
  }
}

/**
 * If the authenticated user currently has a Google placeholder phone, the
 * checkout form must supply a real phone number. Read-only validation.
 */
async function assertRealPhoneIfRequired(
  userId: string | null,
  submittedPhone: string,
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  if (!userId) {
    return { ok: true };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });

  if (user && isGooglePlaceholderPhone(user.phone) && isGooglePlaceholderPhone(submittedPhone)) {
    return {
      ok: false,
      message: "Будь ласка, введіть дійсний номер телефону для оформлення замовлення.",
      status: 400,
    };
  }

  return { ok: true };
}

/**
 * Validate a single checkout payload and resolve everything that requires only
 * read access (zod validation, cart sanitisation, price check, delivery-date
 * resolution). No writes happen here, so a failure leaves the DB untouched —
 * which is what lets the batch be all-or-nothing.
 */
async function prepareOrderForSubmission(
  formData: FormData,
  cartData: OrderCartData,
  deliveryDate: Date | string,
  totalPrice: number,
): Promise<
  | { ok: true; prepared: PreparedOrder }
  | { ok: false; message: string; status: number }
> {
  // --- Server-side validation using Zod ---
  const rawData = {
    name: formData.get("name"),
    phone: normalizePhone((formData.get("phone") as string) || ""),
    address: formData.get("address"),
    comment: formData.get("comment"),
    cutlery: Number(formData.get("cutlery") ?? 0),
    paymentMethod: formData.get("paymentMethod"),
  };

  const validation = checkoutSchema.safeParse(rawData);

  if (!validation.success) {
    const errorMsg = validation.error.issues[0]?.message || "Помилка валідації даних";
    return { ok: false, message: errorMsg, status: 400 };
  }

  const validatedData = validation.data;
  const paymentMethod = validatedData.paymentMethod;

  let sanitizedCartData: OrderCartData;
  try {
    sanitizedCartData = sanitizeCartData(cartData);
  } catch (error) {
    console.error("sanitizeCartData failed", error);
    return {
      ok: false,
      message: "Дані кошика некоректні. Оновіть сторінку та спробуйте ще раз.",
      status: 400,
    };
  }

  if (sanitizedCartData.totalDays < 1) {
    return {
      ok: false,
      message: "У кошику немає жодного повністю зібраного дня.",
      status: 400,
    };
  }

  // Skip standard price validation if using balance
  if (paymentMethod !== "balance") {
    // For Sushka packages, use the passed totalPrice directly (calculated on client)
    const isSushkaPackage = sanitizedCartData.packageType.includes("Sushka");
    if (!isSushkaPackage) {
      const expectedPrice = getOrderTotalUah(sanitizedCartData.packageType, sanitizedCartData.totalDays);
      if (
        typeof totalPrice !== "number" ||
        !Number.isInteger(totalPrice) ||
        totalPrice !== expectedPrice
      ) {
        return {
          ok: false,
          message: "Сума замовлення не збігається з кошиком. Оновіть сторінку та спробуйте ще раз.",
          status: 400,
        };
      }
    } else {
      // For Sushka, just validate that totalPrice is a positive number
      if (typeof totalPrice !== "number" || !Number.isInteger(totalPrice) || totalPrice < 0) {
        return {
          ok: false,
          message: "Сума замовлення некоректна. Оновіть сторінку та спробуйте ще раз.",
          status: 400,
        };
      }
    }
  }

  const submittedDeliveryDate = normalizeDeliveryDateInput(deliveryDate);
  const serverDeliveryDate = await resolveServerDeliveryDate(sanitizedCartData);

  if (!submittedDeliveryDate || !serverDeliveryDate) {
    return {
      ok: false,
      message: "Не вдалося визначити дату доставки.",
      status: 400,
    };
  }

  if (kyivCalendarDateKey(submittedDeliveryDate) !== kyivCalendarDateKey(serverDeliveryDate)) {
    return {
      ok: false,
      message: "Дата доставки не збігається з вибраними днями. Оновіть сторінку та спробуйте ще раз.",
      status: 400,
    };
  }

  return {
    ok: true,
    prepared: {
      validatedData,
      sanitizedCartData,
      resolvedDeliveryDate: submittedDeliveryDate,
      paymentMethod,
      totalPrice,
    },
  };
}

/**
 * Persist ONE prepared order using the supplied transaction client. This must
 * only ever run inside a `prisma.$transaction` callback — it performs all the
 * writes (balance deduction, user upsert, order create) but no external I/O.
 *
 * Balance is read and deducted inside the transaction so that, when several
 * orders for the same package are created in a single batch, each order sees
 * the days already consumed by the previous ones.
 */
async function persistOrderInTransaction(
  tx: Prisma.TransactionClient,
  prepared: PreparedOrder,
  userId: string | null,
): Promise<{ order: Order; user: User }> {
  const { validatedData, sanitizedCartData, resolvedDeliveryDate, paymentMethod, totalPrice } = prepared;
  const isSushkaPackage = sanitizedCartData.packageType.includes("Sushka");

  // --- Start: Split Payment Calculation (inside the transaction) ---
  let balanceDaysToUse = 0;
  let balanceTotalDays = 0;
  let fiatPrice = totalPrice;

  if (userId && paymentMethod !== "cash") {
    const userBalance = await tx.userBalance.findUnique({
      where: {
        userId_packageId: {
          userId,
          packageId: sanitizedCartData.packageType,
        },
      },
    });

    if (userBalance) {
      balanceTotalDays = userBalance.totalDays;
      const availableDays = Math.max(0, userBalance.totalDays - userBalance.usedDays);
      balanceDaysToUse = Math.min(availableDays, sanitizedCartData.totalDays);
      const fiatDays = sanitizedCartData.totalDays - balanceDaysToUse;

      if (fiatDays <= 0) {
        fiatPrice = 0;
      } else if (!isSushkaPackage) {
        fiatPrice = getOrderTotalUah(sanitizedCartData.packageType, fiatDays);
      } else {
        // For Sushka, calculate daily price from original total
        const dailyPrice = Math.round(totalPrice / sanitizedCartData.totalDays);
        fiatPrice = dailyPrice * fiatDays;
      }
    }

    // When the customer explicitly pays from their subscription balance, it
    // MUST cover the whole order. Do NOT silently fall back to a partly-unpaid
    // fiat order — abort the transaction so nothing is created.
    if (paymentMethod === "balance" && balanceDaysToUse < sanitizedCartData.totalDays) {
      throw new Error("INSUFFICIENT_BALANCE");
    }
  }
  // --- End: Split Payment Calculation ---

  // 1. Deduct balance if used — atomic and race-safe.
  if (balanceDaysToUse > 0 && userId && paymentMethod !== "cash") {
    // Conditional update: succeeds only while there are still enough unused days
    // at the moment of the write (usedDays + balanceDaysToUse <= totalDays). The
    // row-level lock serialises concurrent submits, so two tabs / a double click
    // / a webhook replay can never push usedDays past totalDays or drive the
    // balance negative. count !== 1 ⇒ the days were consumed concurrently ⇒
    // abort the whole transaction (INSUFFICIENT_BALANCE) rather than over-deduct
    // or silently create a fiat order.
    const deduction = await tx.userBalance.updateMany({
      where: {
        userId,
        packageId: sanitizedCartData.packageType,
        usedDays: { lte: balanceTotalDays - balanceDaysToUse },
      },
      data: {
        usedDays: {
          increment: balanceDaysToUse,
        },
      },
    });

    if (deduction.count !== 1) {
      throw new Error("INSUFFICIENT_BALANCE");
    }
  }

  if (userId) {
    const currentUser = await tx.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (currentUser) {
      const existingUser = await tx.user.findUnique({
        where: {
          phone: validatedData.phone,
        },
      });

      if (existingUser && existingUser.id !== userId) {
        if (existingUser.chatId) {
          throw new Error("PHONE_IN_USE_BY_TELEGRAM_USER");
        }

        await tx.order.updateMany({
          where: {
            userId: existingUser.id,
          },
          data: {
            userId,
          },
        });

        await tx.user.delete({
          where: {
            id: existingUser.id,
          },
        });
      }

      const user = await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          address: validatedData.address || null,
          defaultCutlery: String(validatedData.cutlery),
          defaultPackage: sanitizedCartData.packageType,
          name: validatedData.name,
          notes: validatedData.comment || null,
          phone: validatedData.phone,
        },
      });

      const order = await tx.order.create({
        data: {
          deliveryAddress: validatedData.address || null,
          deliveryDate: resolvedDeliveryDate,
          deliveryTime: null,
          cutlery: validatedData.cutlery,
          items: sanitizedCartData,
          notes: validatedData.comment || null,
          packageType: sanitizedCartData.packageType,
          price: fiatPrice,
          balanceDaysUsed: balanceDaysToUse,
          isPaid: paymentMethod === "cash" ? false : fiatPrice === 0,
          paymentMethod: paymentMethod || "balance",
          status: "new",
          userId,
        },
      });

      return { order, user };
    }
  }

  const existingUser = await tx.user.findUnique({
    where: {
      phone: validatedData.phone,
    },
  });

  const user = existingUser
    ? await tx.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          address: validatedData.address || null,
          defaultCutlery: String(validatedData.cutlery),
          defaultPackage: sanitizedCartData.packageType,
          name: validatedData.name,
          notes: validatedData.comment || null,
        },
      })
    : await tx.user.create({
        data: {
          address: validatedData.address || null,
          defaultCutlery: String(validatedData.cutlery),
          defaultPackage: sanitizedCartData.packageType,
          name: validatedData.name,
          notes: validatedData.comment || null,
          phone: validatedData.phone,
        },
      });

  const order = await tx.order.create({
    data: {
      deliveryAddress: validatedData.address || null,
      deliveryDate: resolvedDeliveryDate,
      deliveryTime: null,
      cutlery: validatedData.cutlery,
      items: sanitizedCartData,
      notes: validatedData.comment || null,
      packageType: sanitizedCartData.packageType,
      price: fiatPrice,
      balanceDaysUsed: balanceDaysToUse,
      isPaid: paymentMethod === "cash" ? false : fiatPrice === 0,
      paymentMethod: paymentMethod || "balance",
      status: "new",
      userId: user.id,
    },
  });

  return { order, user };
}

/**
 * Fire the external side-effects for a committed order. MUST run AFTER the
 * Prisma transaction has committed — these calls (Telegram, Google Sheets) are
 * not part of the DB transaction and their failures never roll back an order.
 */
async function dispatchOrderSideEffects(
  order: Order,
  user: User,
  validatedData: CheckoutData,
  sanitizedCartData: OrderCartData,
): Promise<void> {
  try {
    await sendOrderNotification(order, user);
  } catch (telegramError) {
    console.error("sendOrderNotification failed", telegramError);
  }

  // Background sync to Google Sheets (non-blocking)
  try {
    syncClientToSheet({
      name: user.name,
      phone: user.phone || validatedData.phone,
      address: user.address || validatedData.address,
      chatId: user.chatId,
      packageType: sanitizedCartData.packageType,
      cutlery: Number(user.defaultCutlery || validatedData.cutlery),
      notes: user.notes || validatedData.comment || "",
    });

    appendOrderToSheet(order, user);
  } catch (sheetError) {
    console.error("Google Sheets sync failed:", sheetError);
  }
}

/** Map a thrown order error to a user-facing message + HTTP status. */
function mapOrderError(error: unknown): { message: string; status: number } {
  if (error instanceof Error) {
    if (error.message === "PHONE_IN_USE_BY_TELEGRAM_USER") {
      return {
        message:
          "Цей номер вже прив’язаний до іншого Telegram-акаунта. Авторизуйтеся саме в ньому або використайте інший номер.",
        status: 409,
      };
    }
    if (error.message === "INSUFFICIENT_BALANCE") {
      return {
        message: "Недостатньо днів на балансі. Будь ласка, поповніть абонемент.",
        status: 400,
      };
    }
    if (error.message === "AUTH_REQUIRED_FOR_BALANCE") {
      return {
        message: "Для оплати з балансу необхідно авторизуватися.",
        status: 401,
      };
    }
  }

  console.error("submit order failed", error);

  return {
    message: "Не вдалося оформити замовлення. Спробуйте ще раз.",
    status: 500,
  };
}

export async function submitOrder(
  formData: FormData,
  cartData: OrderCartData,
  deliveryDate: Date | string,
  totalPrice: number,
): Promise<SubmitOrderResult> {
  const preparation = await prepareOrderForSubmission(formData, cartData, deliveryDate, totalPrice);
  if (!preparation.ok) {
    return { ok: false, message: preparation.message, status: preparation.status };
  }

  const { prepared } = preparation;

  try {
    const userId = await resolveAuthenticatedUserId();

    // Check if user has Google placeholder phone and needs to provide real phone
    const phoneCheck = await assertRealPhoneIfRequired(userId, prepared.validatedData.phone);
    if (!phoneCheck.ok) {
      return { ok: false, message: phoneCheck.message, status: phoneCheck.status };
    }

    // Atomic DB write.
    const { order, user } = await prisma.$transaction((tx: Prisma.TransactionClient) =>
      persistOrderInTransaction(tx, prepared, userId),
    );

    revalidatePath("/");
    revalidatePath("/admin/orders");

    // Side-effects run only after the transaction has committed.
    await dispatchOrderSideEffects(order, user, prepared.validatedData, prepared.sanitizedCartData);

    return {
      ok: true,
      orderId: order.id,
      userId: user.id,
    };
  } catch (error) {
    const mapped = mapOrderError(error);
    return { ok: false, message: mapped.message, status: mapped.status };
  }
}

/**
 * Multi-order checkout entry point — fully transactional.
 *
 * Accepts the multi-package cart, "unrolls" each item's quantity into N
 * identical orders, then:
 *
 *   1. Validates every order up-front (read-only). If a single order is
 *      invalid the whole batch is rejected before anything is written.
 *   2. Persists ALL orders inside a single `prisma.$transaction`. It is an
 *      all-or-nothing operation: if any insert throws, the transaction rolls
 *      back and not a single order is created (no partial fulfillment — a hard
 *      requirement for the LiqPay payment flow).
 *   3. Only after the transaction commits does it fire the external
 *      side-effects (Telegram notifications, Google Sheets export) — these are
 *      deliberately kept OUT of the Prisma transaction and run in parallel, so
 *      a failed notification can never roll back a paid order.
 */
export async function submitOrders(
  formData: FormData,
  items: CartOrderInput[],
  idempotencyKey?: string,
): Promise<SubmitOrdersResult> {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      ok: false,
      message: "Кошик порожній. Додайте хоча б один раціон.",
      status: 400,
      createdCount: 0,
    };
  }

  // Unroll quantity: a cart item with quantity 2 becomes two identical orders.
  const unrolled: Array<{ cartData: OrderCartData; deliveryDate: Date | string; unitPrice: number }> = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || !item.cartData) {
      return {
        ok: false,
        message: "Некоректні дані кошика. Оновіть сторінку та спробуйте ще раз.",
        status: 400,
        createdCount: 0,
      };
    }

    const rawQuantity = Number(item.quantity);
    const quantity =
      Number.isInteger(rawQuantity) && rawQuantity > 0
        ? Math.min(rawQuantity, MAX_CART_ITEM_QUANTITY)
        : 1;

    for (let copy = 0; copy < quantity; copy += 1) {
      unrolled.push({
        cartData: item.cartData,
        deliveryDate: item.deliveryDate,
        unitPrice: item.unitPrice,
      });
    }
  }

  try {
    // Resolve auth once for the whole batch (same customer for every order).
    const userId = await resolveAuthenticatedUserId();

    // 1) Validate & prepare EVERY order before any write. A single invalid
    //    order aborts the whole batch with nothing persisted.
    const prepared: PreparedOrder[] = [];
    for (const order of unrolled) {
      const preparation = await prepareOrderForSubmission(
        formData,
        order.cartData,
        order.deliveryDate,
        order.unitPrice,
      );

      if (!preparation.ok) {
        return {
          ok: false,
          message: preparation.message,
          status: preparation.status,
          createdCount: 0,
        };
      }

      prepared.push(preparation.prepared);
    }

    // Phone validation once (the customer is identical across the batch).
    const phoneCheck = await assertRealPhoneIfRequired(userId, prepared[0].validatedData.phone);
    if (!phoneCheck.ok) {
      return {
        ok: false,
        message: phoneCheck.message,
        status: phoneCheck.status,
        createdCount: 0,
      };
    }

    // 2) Persist ALL orders atomically. If any insert throws, Prisma rolls the
    //    entire batch back → zero orders created.
    const results = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Idempotency guard: claim the key first. A duplicate submit (network
        // retry, double click, function replay) hits the unique constraint and
        // is rejected before any order is created or balance is touched.
        if (idempotencyKey) {
          try {
            await tx.checkoutIdempotency.create({
              data: { key: idempotencyKey, userId },
            });
          } catch (err) {
            if ((err as { code?: string } | null)?.code === "P2002") {
              throw new Error("DUPLICATE_SUBMISSION");
            }
            throw err;
          }
        }

        const created: Array<{ order: Order; user: User; prepared: PreparedOrder }> = [];
        for (const p of prepared) {
          const { order, user } = await persistOrderInTransaction(tx, p, userId);
          created.push({ order, user, prepared: p });
        }

        // Record the resulting order ids so a later retry of the SAME key can be
        // answered with the original result instead of creating duplicates.
        if (idempotencyKey) {
          await tx.checkoutIdempotency.update({
            where: { key: idempotencyKey },
            data: { orderIds: created.map((c) => c.order.id) },
          });
        }

        return created;
      },
      { maxWait: 10000, timeout: 30000 },
    );

    // 3) Transaction committed — now fire external side-effects OUTSIDE the
    //    transaction, in parallel. Failures here never undo a persisted order.
    revalidatePath("/");
    revalidatePath("/admin/orders");

    await Promise.allSettled(
      results.map((r: { order: Order; user: User; prepared: PreparedOrder }) =>
        dispatchOrderSideEffects(r.order, r.user, r.prepared.validatedData, r.prepared.sanitizedCartData),
      ),
    );

    return {
      ok: true,
      orderIds: results.map((r: { order: Order; user: User; prepared: PreparedOrder }) => r.order.id),
      orderCount: results.length,
      userId: results[results.length - 1]?.user.id ?? "",
    };
  } catch (error) {
    // Duplicate submission for an already-used idempotency key. The original
    // request already created (or is creating) the orders — never duplicate.
    if (error instanceof Error && error.message === "DUPLICATE_SUBMISSION" && idempotencyKey) {
      const existing = await prisma.checkoutIdempotency.findUnique({
        where: { key: idempotencyKey },
      });

      // First request already committed → replay its result as success.
      if (existing && existing.orderIds.length > 0) {
        return {
          ok: true,
          orderIds: existing.orderIds,
          orderCount: existing.orderIds.length,
          userId: existing.userId ?? "",
        };
      }

      // First request is still in flight (key claimed, orders not committed yet).
      return {
        ok: false,
        message: "Замовлення вже обробляється. Зачекайте кілька секунд і не надсилайте його повторно.",
        status: 409,
        createdCount: 0,
      };
    }

    // Any other failure inside the transaction rolls everything back → 0 created.
    const mapped = mapOrderError(error);
    return {
      ok: false,
      message: mapped.message,
      status: mapped.status,
      createdCount: 0,
    };
  }
}
