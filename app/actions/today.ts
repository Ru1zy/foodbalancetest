"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateOrderDeliveryInfo(
  orderId: string,
  deliveryTime: string | null,
  notes: string | null
) {
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryTime: deliveryTime || null,
        notes: notes || null,
      },
    });

    revalidatePath("/admin/today");
    return { ok: true };
  } catch (error) {
    console.error("Error updating order delivery info:", error);
    return { ok: false, message: "Помилка оновлення даних" };
  }
}

export async function notifyTodayOrders(dateStr: string) {
  try {
    // Parse date in DD.MM.YYYY format
    const [day, month, year] = dateStr.split(".");
    const targetDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day)
    );
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Fetch all paid orders for the target date with user data
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: targetDate,
          lt: nextDay,
        },
        isPaid: true,
        status: { not: "cancelled" },
      },
      include: {
        user: true,
      },
    });

    let sent = 0;
    let skipped = 0;
    const skippedReasons: string[] = [];

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return {
        ok: false,
        message: "TELEGRAM_BOT_TOKEN не налаштовано",
        sent: 0,
        skipped: orders.length,
      };
    }

    for (const order of orders) {
      // Skip if no chatId
      if (!order.user.chatId) {
        skipped++;
        skippedReasons.push(`${order.user.name}: немає chatId`);
        continue;
      }

      // Skip if no delivery time
      if (!order.deliveryTime) {
        skipped++;
        skippedReasons.push(`${order.user.name}: немає часу доставки`);
        continue;
      }

      // Build message
      let message = `Сьогодні у вас доставка:\nПІБ: <b>${order.user.name}</b>\nЧас доставки: ${order.deliveryTime} ⏰`;

      if (order.notes) {
        message += `\n\nНотатка для Вас: ${order.notes}`;
      }

      // Send Telegram message
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: order.user.chatId,
              text: message,
              parse_mode: "HTML",
            }),
          }
        );

        if (response.ok) {
          sent++;
        } else {
          skipped++;
          skippedReasons.push(
            `${order.user.name}: помилка відправки (${response.status})`
          );
        }
      } catch (error) {
        skipped++;
        skippedReasons.push(`${order.user.name}: помилка мережі`);
      }
    }

    return {
      ok: true,
      sent,
      skipped,
      skippedReasons,
      total: orders.length,
    };
  } catch (error) {
    console.error("Error notifying today orders:", error);
    return {
      ok: false,
      message: "Помилка відправки сповіщень",
      sent: 0,
      skipped: 0,
    };
  }
}
