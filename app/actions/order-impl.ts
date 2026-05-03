"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import {
  earliestMenuDeliveryDateFromCartDays,
  getOrderTotalUah,
  getPackageLimit,
  PackageType,
} from "@/lib/order-logic";
import { kyivCalendarDateKey, parseCheckoutFormData, validateCheckoutFormValues } from "@/lib/checkout";
import { verifyAuthToken } from "@/lib/auth-token";
import { isIndivPackage, type IndivDishQuantity } from "@/lib/order-selection";
import { sendOrderNotification } from "@/lib/telegram";
import { checkoutSchema } from "@/lib/validations";
import { syncClientToSheet } from "@/lib/googleSheets";

export type StandardSelections = Record<string, number>;

export type OrderCartDay = {
  dayId: string;
  items?: IndivDishQuantity[];
  selectedCount: number;
  selections?: StandardSelections;
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

function sanitizeCartData(cartData: OrderCartData): OrderCartData {
  // CRITICAL: Calculate server-side package limit - NEVER trust client's packageLimit
  const serverPackageLimit = getPackageLimit(cartData.packageType).limit;

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

        if (indivPackage) {
          if (!Array.isArray(day.items)) {
            return false;
          }

          const normalizedItems = day.items.filter(
            (item) =>
              !!item &&
              typeof item.dishId === "string" &&
              (item.dishId || '').trim().length > 0 &&
              Number.isInteger(item.quantity) &&
              item.quantity > 0 &&
              item.quantity <= 3, // Max 3 of same dish for Indiv
          );

          const totalQuantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);

          // For Indiv: min 1, max 10 total dishes per day
          if (totalQuantity < 1 || totalQuantity > 10) {
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
      if (indivPackage) {
        return {
          dayId: day.dayId,
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

  const menuDayByItemId = Object.fromEntries(rows.map((r) => [r.id, r.dayOfWeek]));
  return earliestMenuDeliveryDateFromCartDays(sanitizedCartData.days, menuDayByItemId, new Date());
}

function normalizeDeliveryDateInput(value: Date | string): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function submitOrder(
  formData: FormData,
  cartData: OrderCartData,
  deliveryDate: Date | string,
  totalPrice: number,
): Promise<SubmitOrderResult> {
  // --- Server-side validation using Zod ---
  const rawData = {
    name: formData.get("name"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    comment: formData.get("comment"),
    cutlery: Number(formData.get("cutlery") ?? 0),
    paymentMethod: formData.get("paymentMethod"),
  };

  const validation = checkoutSchema.safeParse(rawData);

  if (!validation.success) {
    const errorMsg = validation.error.issues[0]?.message || "Помилка валідації даних";
    return {
      ok: false,
      message: errorMsg,
      status: 400,
    };
  }

  const validatedData = validation.data;
  const sanitizedCartData = sanitizeCartData(cartData);
  const paymentMethod = validatedData.paymentMethod;

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

  const resolvedDeliveryDate = submittedDeliveryDate;

  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token")?.value;
    let userId: string | null = null;

    if (authToken) {
      try {
        userId = await verifyAuthToken(authToken);
      } catch (authError) {
        console.error("submitOrder auth token verification failed", authError);
      }
    }

    // --- Start: Split Payment Calculation ---
    let balanceDaysToUse = 0;
    let fiatPrice = totalPrice;
    const isSushkaPackage = sanitizedCartData.packageType.includes("Sushka");

    if (userId && paymentMethod !== "cash") {
      const userBalance = await prisma.userBalance.findUnique({
        where: {
          userId_packageId: {
            userId,
            packageId: sanitizedCartData.packageType,
          },
        },
      });

      if (userBalance) {
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
    }
    // --- End: Split Payment Calculation ---

    const { order, user } = await prisma.$transaction(async (tx) => {
      // 1. Deduct balance if used
      if (balanceDaysToUse > 0 && userId && paymentMethod !== "cash") {
        await tx.userBalance.update({
          where: {
            userId_packageId: {
              userId,
              packageId: sanitizedCartData.packageType,
            },
          },
          data: {
            usedDays: {
              increment: balanceDaysToUse,
            },
          },
        });
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
    });

    try {
      await sendOrderNotification(order, user);
    } catch (telegramError) {
      console.error("sendOrderNotification failed", telegramError);
    }

    revalidatePath("/");
    revalidatePath("/admin/orders");

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
    } catch (sheetError) {
      console.error("Google Sheets sync failed:", sheetError);
    }

    return {
      ok: true,
      orderId: order.id,
      userId: user.id,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PHONE_IN_USE_BY_TELEGRAM_USER") {
        return {
          ok: false,
          message:
            "Цей номер вже прив’язаний до іншого Telegram-акаунта. Авторизуйтеся саме в ньому або використайте інший номер.",
          status: 409,
        };
      }
      if (error.message === "INSUFFICIENT_BALANCE") {
        return {
          ok: false,
          message: "Недостатньо днів на балансі. Будь ласка, поповніть абонемент.",
          status: 400,
        };
      }
      if (error.message === "AUTH_REQUIRED_FOR_BALANCE") {
        return {
          ok: false,
          message: "Для оплати з балансу необхідно авторизуватися.",
          status: 401,
        };
      }
    }

    console.error("submitOrder failed", error);

    return {
      ok: false,
      message: "Не вдалося оформити замовлення. Спробуйте ще раз.",
      status: 500,
    };
  }
}
