"use server";

import { revalidatePath } from "next/cache";
import { google } from "googleapis";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { isOrderStatus, type OrderStatus } from "@/lib/order-status";
import { sendPaymentConfirmation } from "@/lib/telegram";

// ============================================================================
// TYPES
// ============================================================================

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

export type ArchiveOrdersResult =
  | {
      ok: true;
      archived: number;
      deleted: number;
    }
  | {
      ok: false;
      message: string;
    };

export type ExportToKitchenSheetResult =
  | {
      ok: true;
      exported: number;
    }
  | {
      ok: false;
      message: string;
    };

// ============================================================================
// ORDER STATUS & PAYMENT
// ============================================================================

export async function updateOrderStatus(orderId: string, status: string): Promise<UpdateOrderStatusResult> {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return {
      ok: false,
      message: "Недостатньо прав для оновлення статусу.",
    };
  }

  const nextOrderId = (orderId || '').trim();
  const nextStatus = (status || '').trim();

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

  const nextOrderId = (orderId || '').trim();

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

// ============================================================================
// TELEGRAM NOTIFICATIONS
// ============================================================================

export async function notifyDeliveryTime(orderId: string, timeWindow: string): Promise<ConfirmPaymentResult> {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return {
      ok: false,
      message: "Недостатньо прав для відправки повідомлення.",
    };
  }

  if (!(orderId || '').trim() || !(timeWindow || '').trim()) {
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

export async function sendDirectMessage(chatId: string, htmlContent: string): Promise<ConfirmPaymentResult> {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return {
      ok: false,
      message: "Недостатньо прав для відправки повідомлення.",
    };
  }

  if (!chatId.trim() || !htmlContent.trim()) {
    return {
      ok: false,
      message: "Не вказано отримувача або повідомлення порожнє.",
    };
  }

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlContent,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        message: "Не вдалося відправити повідомлення через Telegram API.",
      };
    }

    return {
      ok: true,
    };
  } catch (error) {
    console.error("sendDirectMessage failed", error);

    return {
      ok: false,
      message: "Не вдалося відправити повідомлення.",
    };
  }
}

// ============================================================================
// ARCHIVE ORDERS
// ============================================================================

/**
 * Archive old orders and clean up abandoned carts.
 * Based on legacy autoArchiveDaily logic from Google Apps Script bot.
 *
 * Rules:
 * 1. Orders with deliveryDate in the past (before today's midnight in Kyiv):
 *    - If isPaid=true OR status is "delivered"/"processed" → archive
 * 2. Orders older than 7 days with isPaid=false and not processed → DELETE
 */
export async function archiveOldOrders(): Promise<ArchiveOrdersResult> {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return {
      ok: false,
      message: "Недостатньо прав для архівації замовлень.",
    };
  }

  try {
    // Get today's midnight in Kyiv timezone
    const todayString = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kiev' });
    const todayMidnightKyiv = new Date(`${todayString}T00:00:00.000+03:00`);

    // Get date 7 days ago
    const sevenDaysAgo = new Date(todayMidnightKyiv);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find orders to archive: past delivery date, paid or delivered/processed
    const ordersToArchive = await prisma.order.findMany({
      where: {
        deliveryDate: {
          lt: todayMidnightKyiv,
        },
        status: {
          not: "archived",
        },
        OR: [
          { isPaid: true },
          { status: { in: ["delivered", "processed", "Оплачено", "Доставлено"] } },
        ],
      },
      select: {
        id: true,
      },
    });

    // Archive them
    const archivedResult = await prisma.order.updateMany({
      where: {
        id: {
          in: ordersToArchive.map(o => o.id),
        },
      },
      data: {
        status: "archived",
      },
    });

    // Find abandoned carts to delete: older than 7 days, not paid, not processed
    const deletedResult = await prisma.order.deleteMany({
      where: {
        deliveryDate: {
          lt: sevenDaysAgo,
        },
        isPaid: false,
        status: {
          notIn: ["delivered", "processed", "archived", "Оплачено", "Доставлено"],
        },
      },
    });

    revalidatePath("/admin/orders");

    return {
      ok: true,
      archived: archivedResult.count,
      deleted: deletedResult.count,
    };
  } catch (error) {
    console.error("archiveOldOrders failed", error);

    return {
      ok: false,
      message: "Не вдалося виконати архівацію замовлень.",
    };
  }
}

// ============================================================================
// TODAY PAGE - DELIVERY INFO & NOTIFICATIONS
// ============================================================================

export async function updateOrderDeliveryInfo(
  orderId: string,
  deliveryTime: string | null,
  deliveryNote: string | null
) {
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryTime: deliveryTime || null,
        deliveryNote: deliveryNote || null,
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

      if (order.deliveryNote) {
        message += `\n\nНотатка для Вас: ${order.deliveryNote}`;
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

// ============================================================================
// KITCHEN EXPORT - GOOGLE SHEETS
// ============================================================================

/**
 * Parse date string "DD.MM" and find matching orders by deliveryDate.
 * Returns orders where deliveryDate matches the target date in Kyiv timezone.
 */
function parseTargetDate(targetDateStr: string): { start: Date; end: Date } | null {
  const match = targetDateStr.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);

  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  // Get current year in Kyiv timezone
  const currentYear = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Europe/Kiev'
  }).split('-')[0];

  // Create date range for the target day in Kyiv timezone
  const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const start = new Date(`${dateStr}T00:00:00.000+03:00`);
  const end = new Date(`${dateStr}T23:59:59.999+03:00`);

  return { start, end };
}

/**
 * Format dishes from order items into a single string.
 * Resolves dish indices to actual names from Menu records.
 * Adds portion indicators for Active/Sport Active plans.
 */
async function formatOrderDishes(
  items: unknown,
  menuById: Map<string, { dishes: unknown }>,
  packageType: string
): Promise<string> {
  if (!items || typeof items !== "object") return "";

  const days = (items as Record<string, unknown>).days;
  if (!Array.isArray(days) || days.length === 0) return "";

  // Collect all dish names from all days
  const allDishes: string[] = [];

  for (const day of days) {
    // Handle individual package items (Indiv package)
    if (Array.isArray(day.items)) {
      for (const item of day.items) {
        const dishId = item.dishId || "";
        const quantity = item.quantity || 1;
        for (let i = 0; i < quantity; i++) {
          allDishes.push(dishId);
        }
      }
    }

    // Handle standard package selections
    if (day.selections && typeof day.selections === "object" && day.dayId) {
      const menu = menuById.get(day.dayId);

      if (!menu) {
        continue; // Skip if menu not found
      }

      const dishes = typeof menu.dishes === "string" ? JSON.parse(menu.dishes) : menu.dishes;

      // Extract all selected dish names
      Object.entries(day.selections).forEach(([category, selectionIndex]) => {
        const categoryDishes = dishes[category];

        if (Array.isArray(categoryDishes) && typeof selectionIndex === "number" && categoryDishes[selectionIndex]) {
          const dish = categoryDishes[selectionIndex];
          let dishName =
            typeof dish === "object" && dish !== null
              ? dish.short || dish.full || dish.name
              : dish;

          if (dishName) {
            dishName = String(dishName).trim();

            // Add portion indicator for Active/Sport Active plans
            if (['Active', 'Sport Active'].includes(packageType) && ['lunch', 'dinner'].includes(category)) {
              if (!dishName.includes('(1,5)')) {
                dishName += " (1,5)";
              }
            }

            allDishes.push(dishName);
          }
        }
      });
    }
  }

  return allDishes.join(" + ");
}

/**
 * Export orders to Google Sheets with strict template compliance.
 *
 * Algorithm:
 * 1. Authenticate with Google Sheets API
 * 2. Fetch orders for target date (allow re-export)
 * 3. Fetch Menu records to resolve dish names
 * 4. Calculate first empty row (data starts at row 5)
 * 5. Format each order as a 9-column row (C through K)
 * 6. Update the sheet using update API (not append)
 * 7. Mark orders as exported (AFTER successful API call)
 */
export async function exportToKitchenSheet(
  targetDateStr: string
): Promise<ExportToKitchenSheetResult> {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return {
      ok: false,
      message: "Недостатньо прав для експорту.",
    };
  }

  // Validate environment variables
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.EXTERNAL_SHEET_ID;

  if (!clientEmail || !privateKey || !sheetId) {
    return {
      ok: false,
      message: "Не налаштовано Google Sheets API. Перевірте змінні оточення.",
    };
  }

  // Parse target date
  const dateRange = parseTargetDate(targetDateStr);
  if (!dateRange) {
    return {
      ok: false,
      message: "Некоректний формат дати. Використовуйте формат DD.MM (наприклад, 23.02).",
    };
  }

  try {
    // Authenticate with Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Fetch orders for the target date (allow re-export)
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            chatId: true,
          },
        },
      },
    });

    if (orders.length === 0) {
      return {
        ok: false,
        message: `Не знайдено замовлень для експорту на ${targetDateStr}.`,
      };
    }

    // Collect all unique dayIds from all orders to fetch menus efficiently
    const dayIds = new Set<string>();
    for (const order of orders) {
      if (order.items && typeof order.items === "object") {
        const days = (order.items as Record<string, unknown>).days;
        if (Array.isArray(days)) {
          for (const day of days) {
            if (day && typeof day === "object" && "dayId" in day && typeof day.dayId === "string") {
              dayIds.add(day.dayId);
            }
          }
        }
      }
    }

    // Fetch all relevant Menu records in one query (avoid N+1)
    const menus = await prisma.menu.findMany({
      where: {
        id: {
          in: Array.from(dayIds),
        },
      },
      select: {
        id: true,
        dishes: true,
      },
    });

    const menuById = new Map(menus.map((menu) => [menu.id, menu]));

    // Calculate first empty row (data starts at row 5)
    const existingDataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${targetDateStr}'!C5:C200`,
    });

    let firstEmptyRow = 5;
    const existingValues = existingDataResponse.data.values;

    if (existingValues && existingValues.length > 0) {
      // Find first empty cell in column C
      const emptyIndex = existingValues.findIndex(
        (row) => !row[0] || row[0].toString().trim() === ""
      );

      if (emptyIndex !== -1) {
        // Found an empty gap
        firstEmptyRow = 5 + emptyIndex;
      } else {
        // All rows filled, append after last row
        firstEmptyRow = 5 + existingValues.length;
      }
    }

    // Format orders into rows (columns C-K: 9 columns)
    const rows: string[][] = await Promise.all(
      orders.map(async (order) => {
        const formattedDishes = await formatOrderDishes(order.items, menuById, order.packageType);

        return [
          order.user.name || "", // C: ПІБ
          order.user.phone || "", // D: Телефон
          order.user.address || "", // E: Адреса
          order.user.chatId || "", // F: Chat ID
          order.packageType || "", // G: Раціон
          formattedDishes || "Меню не знайдено", // H: Страви
          order.cutlery ? `${order.cutlery} шт` : "0 шт", // I: Прибори
          order.deliveryNote || "", // J: Нотатка адміна
          order.price ? order.price.toString() : "", // K: Ціна
        ];
      })
    );

    // Update the sheet (not append)
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${targetDateStr}'!C${firstEmptyRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows,
      },
    });

    // Mark orders as exported (AFTER successful Google API call)
    await prisma.order.updateMany({
      where: {
        id: {
          in: orders.map((o) => o.id),
        },
      },
      data: {
        status: "Передано в учёт",
      },
    });

    console.log(`Exported ${orders.length} orders to Google Sheets at row ${firstEmptyRow}`);

    return {
      ok: true,
      exported: orders.length,
    };
  } catch (error) {
    console.error("exportToKitchenSheet failed", error);

    return {
      ok: false,
      message: error instanceof Error ? error.message : "Не вдалося експортувати в Google Sheets.",
    };
  }
}
