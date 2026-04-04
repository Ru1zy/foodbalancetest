"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { PackageType } from "@/lib/order-logic";
import {
  parseCheckoutFormData,
  validateCheckoutFormValues,
} from "@/src/lib/checkout";
import { verifyAuthToken } from "@/src/lib/auth-token";
import { isIndivPackage, type IndivDishQuantity } from "@/src/lib/order-selection";
import { sendOrderNotification } from "@/src/lib/telegram";

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

function getNearestMonday() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });

  const parts = formatter.formatToParts(new Date());
  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  const weekdayMap: Record<string, number> = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
    Sunday: 0,
  };

  const weekday = weekdayMap[values.weekday];
  const daysUntilMonday = weekday === 1 ? 0 : weekday === 0 ? 1 : 8 - weekday;

  return new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day) + daysUntilMonday,
      0,
      0,
      0,
      0,
    ),
  );
}

function sanitizeCartData(cartData: OrderCartData): OrderCartData {
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
              item.quantity > 0,
          );

          const totalQuantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);

          return totalQuantity === cartData.packageLimit && day.selectedCount === cartData.packageLimit;
        }

        if (!day.selections || typeof day.selections !== "object" || Array.isArray(day.selections)) {
          return false;
        }

        const normalizedSelections = Object.entries(day.selections).filter(
          ([category, index]) => category.trim().length > 0 && Number.isInteger(index) && index >= 0,
        );

        return normalizedSelections.length === cartData.packageLimit && day.selectedCount === cartData.packageLimit;
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
    packageLimit: cartData.packageLimit,
    packageType: cartData.packageType,
    totalDays: days.length,
  };
}

export async function submitOrder(formData: FormData, cartData: OrderCartData): Promise<SubmitOrderResult> {
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
              address:
                parsedFormData.deliveryMethod === "delivery"
                  ? parsedFormData.address || null
                  : currentUser.address,
              defaultCutlery: String(parsedFormData.cutlery),
              defaultPackage: sanitizedCartData.packageType,
              name: parsedFormData.name,
              notes: parsedFormData.comment || null,
              phone: parsedFormData.phone,
            },
          });

          const order = await tx.order.create({
            data: {
              deliveryAddress:
                parsedFormData.deliveryMethod === "delivery" ? parsedFormData.address || null : null,
              deliveryDate: new Date(parsedFormData.deliveryDate),
              deliveryMethod: parsedFormData.deliveryMethod,
              cutlery: parsedFormData.cutlery,
              items: sanitizedCartData,
              notes: parsedFormData.comment || null,
              packageType: sanitizedCartData.packageType,
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
              address:
                parsedFormData.deliveryMethod === "delivery"
                  ? parsedFormData.address || null
                  : existingUser.address,
              defaultCutlery: String(parsedFormData.cutlery),
              defaultPackage: sanitizedCartData.packageType,
              name: parsedFormData.name,
              notes: parsedFormData.comment || null,
            },
          })
        : await tx.user.create({
            data: {
              address:
                parsedFormData.deliveryMethod === "delivery" ? parsedFormData.address || null : null,
              defaultCutlery: String(parsedFormData.cutlery),
              defaultPackage: sanitizedCartData.packageType,
              name: parsedFormData.name,
              notes: parsedFormData.comment || null,
              phone: parsedFormData.phone,
            },
          });

      const order = await tx.order.create({
        data: {
          deliveryAddress:
            parsedFormData.deliveryMethod === "delivery" ? parsedFormData.address || null : null,
          deliveryDate: new Date(parsedFormData.deliveryDate),
          deliveryMethod: parsedFormData.deliveryMethod,
          cutlery: parsedFormData.cutlery,
          items: sanitizedCartData,
          notes: parsedFormData.comment || null,
          packageType: sanitizedCartData.packageType,
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
