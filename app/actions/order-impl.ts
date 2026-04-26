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
  const serverPackageLimit = getPackageLimit(cartData.packageType);

  // Validate that client-provided limit matches server calculation
  if (cartData.packageLimit !== serverPackageLimit) {
    throw new Error(
      `Package limit mismatch: client sent ${cartData.packageLimit}, server expects ${serverPackageLimit} for ${cartData.packageType}`
    );
  }

  // For Sushka packages (XS and S), bypass strict dish selection validation
  if (cartData.packageType.includes("Sushka")) {
    const days = (Array.isArray(cartData.days) ? cartData.days : [])
      .filter((day) => day && typeof day.dayId === "string" && day.dayId.trim().length > 0)
      .map((day) => ({
        dayId: day.dayId.trim(),
        selectedCount: 0,
        selections: {} as StandardSelections,
      }));

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
        if (!day || typeof day.dayId !== "string" || !day.dayId.trim()) {
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
              item.dishId.trim().length > 0 &&
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
          ([category, index]) => category.trim().length > 0 && Number.isInteger(index) && index >= 0,
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
                item.dishId.trim().length > 0 &&
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
  const parsedFormData = parseCheckoutFormData(formData);
  const validationErrors = validateCheckoutFormValues(parsedFormData);

  if (validationErrors.name || validationErrors.phone || validationErrors.address) {
    return {
      ok: false,
      message:
        validationErrors.name ||
        validationErrors.phone ||
        validationErrors.address ||
        "Перевірте дані замовлення.",
      status: 400,
    };
  }

  const sanitizedCartData = sanitizeCartData(cartData);

  if (sanitizedCartData.totalDays < 1) {
    return {
      ok: false,
      message: "У кошику немає жодного повністю зібраного дня.",
      status: 400,
    };
  }

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

    const { order, user } = await prisma.$transaction(async (tx) => {
      if (userId) {
        const currentUser = await tx.user.findUnique({
          where: {
            id: userId,
          },
        });

        if (currentUser) {
          const existingUser = await tx.user.findUnique({
            where: {
              phone: parsedFormData.phone,
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
              address: parsedFormData.address || null,
              defaultCutlery: String(parsedFormData.cutlery),
              defaultPackage: sanitizedCartData.packageType,
              name: parsedFormData.name,
              notes: parsedFormData.comment || null,
              phone: parsedFormData.phone,
            },
          });

          const order = await tx.order.create({
            data: {
              deliveryAddress: parsedFormData.address || null,
              deliveryDate: resolvedDeliveryDate,
              deliveryTime: parsedFormData.deliveryTime || null,
              cutlery: parsedFormData.cutlery,
              items: sanitizedCartData,
              notes: parsedFormData.comment || null,
              packageType: sanitizedCartData.packageType,
              price: totalPrice,
              status: "new",
              userId,
            },
          });

          return { order, user };
        }
      }

      const existingUser = await tx.user.findUnique({
        where: {
          phone: parsedFormData.phone,
        },
      });

      const user = existingUser
        ? await tx.user.update({
            where: {
              id: existingUser.id,
            },
            data: {
              address: parsedFormData.address || null,
              defaultCutlery: String(parsedFormData.cutlery),
              defaultPackage: sanitizedCartData.packageType,
              name: parsedFormData.name,
              notes: parsedFormData.comment || null,
            },
          })
        : await tx.user.create({
            data: {
              address: parsedFormData.address || null,
              defaultCutlery: String(parsedFormData.cutlery),
              defaultPackage: sanitizedCartData.packageType,
              name: parsedFormData.name,
              notes: parsedFormData.comment || null,
              phone: parsedFormData.phone,
            },
          });

      const order = await tx.order.create({
        data: {
          deliveryAddress: parsedFormData.address || null,
          deliveryDate: resolvedDeliveryDate,
          deliveryTime: parsedFormData.deliveryTime || null,
          cutlery: parsedFormData.cutlery,
          items: sanitizedCartData,
          notes: parsedFormData.comment || null,
          packageType: sanitizedCartData.packageType,
          price: totalPrice,
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

    return {
      ok: true,
      orderId: order.id,
      userId: user.id,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "PHONE_IN_USE_BY_TELEGRAM_USER") {
      return {
        ok: false,
        message:
          "Цей номер вже прив’язаний до іншого Telegram-акаунта. Авторизуйтеся саме в ньому або використайте інший номер.",
        status: 409,
      };
    }

    console.error("submitOrder failed", error);

    return {
      ok: false,
      message: "Не вдалося оформити замовлення. Спробуйте ще раз.",
      status: 500,
    };
  }
}
