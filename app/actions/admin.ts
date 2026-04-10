"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { isOrderStatus, type OrderStatus } from "@/lib/order-status";
import { sendPaymentConfirmation } from "@/lib/telegram";

export type UpdateOrderStatusResult =
  | {
      ok: true;
      status: OrderStatus;
    }
  | {
      message: string;
      ok: false;
    };

export type ConfirmPaymentResult =
  | {
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

export async function updateOrderStatus(orderId: string, status: string): Promise<UpdateOrderStatusResult> {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return {
      ok: false,
      message: "Недостатньо прав для оновлення статусу.",
    };
  }

  const nextOrderId = orderId.trim();
  const nextStatus = status.trim();

  if (!nextOrderId) {
    return {
      ok: false,
      message: "Не вдалося визначити замовлення.",
    };
  }

  if (!isOrderStatus(nextStatus)) {
    return {
      ok: false,
      message: "Некоректний статус замовлення.",
    };
  }

  try {
    await prisma.order.update({
      where: {
        id: nextOrderId,
      },
      data: {
        status: nextStatus,
      },
    });

    revalidatePath("/admin/orders");

    return {
      ok: true,
      status: nextStatus,
    };
  } catch (error) {
    console.error("updateOrderStatus failed", error);

    return {
      ok: false,
      message: "Не вдалося оновити статус замовлення.",
    };
  }
}

export async function confirmOrderPayment(orderId: string): Promise<ConfirmPaymentResult> {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return {
      ok: false,
      message: "Недостатньо прав для підтвердження оплати.",
    };
  }

  const nextOrderId = orderId.trim();

  if (!nextOrderId) {
    return {
      ok: false,
      message: "Не вдалося визначити замовлення.",
    };
  }

  try {
    const order = await prisma.order.update({
      where: {
        id: nextOrderId,
      },
      data: {
        isPaid: true,
        status: "Оплачено",
      },
      include: {
        user: true,
      },
    });

    if (order.user.chatId) {
      await sendPaymentConfirmation(order.user.chatId, {
        date: order.deliveryDate,
        pkg: order.packageType,
      });
    }

    revalidatePath("/admin/orders");

    return {
      ok: true,
    };
  } catch (error) {
    console.error("confirmOrderPayment failed", error);

    return {
      ok: false,
      message: "Не вдалося підтвердити оплату.",
    };
  }
}
