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

export async function notifyDeliveryTime(orderId: string, timeWindow: string): Promise<ConfirmPaymentResult> {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return {
      ok: false,
      message: "Недостатньо прав для відправки повідомлення.",
    };
  }

  if (!orderId.trim() || !timeWindow.trim()) {
    return {
      ok: false,
      message: "Не вказано час доставки.",
    };
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      return {
        ok: false,
        message: "Замовлення не знайдено.",
      };
    }

    if (!order.user.chatId) {
      return {
        ok: false,
        message: "У користувача немає Telegram ID.",
      };
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const message = `🚚 <b>Доставка!</b>\n\nВаш раціон <b>${order.packageType}</b> буде доставлено сьогодні в проміжку <b>${timeWindow}</b>.\nОчікуйте кур'єра.`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: order.user.chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    return {
      ok: true,
    };
  } catch (error) {
    console.error("notifyDeliveryTime failed", error);

    return {
      ok: false,
      message: "Не вдалося відправити повідомлення.",
    };
  }
}

export async function broadcastMessage(htmlContent: string): Promise<{ ok: boolean; sent: number; message?: string }> {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return {
      ok: false,
      sent: 0,
      message: "Недостатньо прав для розсилки.",
    };
  }

  if (!htmlContent.trim()) {
    return {
      ok: false,
      sent: 0,
      message: "Повідомлення порожнє.",
    };
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        chatId: {
          not: null,
        },
      },
      select: {
        chatId: true,
      },
    });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    let sentCount = 0;

    for (const user of users) {
      if (!user.chatId) continue;

      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: user.chatId,
            text: htmlContent,
            parse_mode: "HTML",
          }),
        });

        sentCount++;

        // Rate limit: 30 messages/second = ~33ms between messages
        // Use 50ms to be safe
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Failed to send to ${user.chatId}:`, error);
      }
    }

    return {
      ok: true,
      sent: sentCount,
    };
  } catch (error) {
    console.error("broadcastMessage failed", error);

    return {
      ok: false,
      sent: 0,
      message: "Не вдалося виконати розсилку.",
    };
  }
}
