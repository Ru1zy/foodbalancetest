"use server";

import { revalidatePath } from "next/cache";
import { google } from "googleapis";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { isOrderStatus, type OrderStatus } from "@/lib/order-status";
import { sendPaymentConfirmation } from "@/lib/telegram";
import { normalizePhoneForLegacy } from "@/lib/googleSheets";

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

  if (!(htmlContent || "").trim()) {
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
          in: ordersToArchive.map((o: { id: string }) => o.id),
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
    // Parse target date DD.MM
    const dateRange = parseTargetDate(dateStr);
    if (!dateRange) {
      return {
        ok: false,
        message: "Некоректний формат дати. Використовуйте DD.MM",
      };
    }

    // Fetch all paid orders for the target date with user data
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: dateRange.start,
          lte: dateRange.end,
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
      } catch {
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

interface Dish {
  short?: string;
  full?: string;
  name?: string;
}

interface OrderDay {
  dayOfWeek: number;
  dayId: string;
  items?: Array<{ dishId: string; quantity: number }>;
  selections?: Record<string, number>;
}

/**
 * Format dishes from order items into a single string for a specific date.
 */
async function formatOrderDishes(
  items: unknown,
  menuById: Map<string, { dishes: unknown; dayOfWeek?: number }>,
  packageType: string,
  targetDate: Date,
  startDate: Date
): Promise<string> {
  if (!items || typeof items !== "object") return "";

  const CATEGORY_LABELS: Record<string, string> = {
    breakfast: "Сніданок",
    lunch: "Обід",
    dinner: "Вечеря",
    snack: "Перекус",
    extra: "Додатково",
  };

  const days = (items as Record<string, unknown>).days;
  if (!Array.isArray(days) || days.length === 0) return "";

  // Task 2: Bruteforce Indiv/Custom Mode Date Matching via Index
  // Normalize to Kyiv calendar dates to avoid off-by-one errors from UTC shifts
  const kyivISO = { timeZone: 'Europe/Kiev', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  const startStr = new Intl.DateTimeFormat('en-CA', kyivISO).format(new Date(startDate));
  const targetStr = new Intl.DateTimeFormat('en-CA', kyivISO).format(new Date(targetDate));
  
  const s = new Date(startStr);
  const t = new Date(targetStr);
  const dayIndex = Math.floor((t.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));

  let day: OrderDay | null = null;
  if (dayIndex >= 0 && dayIndex < days.length) {
    day = (days as OrderDay[])[dayIndex];
  }

  if (!day) return "";

  const allDishes: string[] = [];
  // Handle individual/custom items (Indiv or Custom Mode)
  if (Array.isArray(day.items) && day.items.length > 0) {
    const menu = menuById.get(day.dayId);
    const menuDishes = menu ? (typeof menu.dishes === "string" ? JSON.parse(menu.dishes) : menu.dishes) as Record<string, Dish[]> : null;

    for (const item of day.items) {
      const dishId = item.dishId || "";
      const quantity = item.quantity || 1;
      
      const separatorIndex = dishId.lastIndexOf(":");
      let dishName = dishId;

      if (separatorIndex > 0 && menuDishes) {
        const cat = dishId.slice(0, separatorIndex);
        const idx = parseInt(dishId.slice(separatorIndex + 1));
        const categoryDishes = menuDishes[cat];
        
        if (Array.isArray(categoryDishes) && categoryDishes[idx]) {
          const dish = categoryDishes[idx];
          dishName = (typeof dish === "object" && dish !== null) ? dish.short || dish.full || dish.name || dishName : dishName;
        } else {
          const label = CATEGORY_LABELS[cat] || cat;
          dishName = `${label} №${idx + 1}`;
        }
      }

      if (dishName) {
        dishName = String(dishName).trim();
        // Add portion indicator for Active/Sport plans
        if (['Active', 'Sport'].some(p => packageType.includes(p)) && (dishId.includes('lunch') || dishId.includes('dinner'))) {
          if (!dishName.includes('(1,5)')) dishName += " (1,5)";
        }
        
        // Task 3: Use (xN) format for custom items
        allDishes.push(`${dishName} (x${quantity})`);
      }
    }
  }

  // Handle standard package selections (if items was empty)
  if (allDishes.length === 0 && day.selections && typeof day.selections === "object" && day.dayId) {
    const menu = menuById.get(day.dayId);
    if (menu) {
      try {
        const dishes = (typeof menu.dishes === "string" ? JSON.parse(menu.dishes) : menu.dishes) as Record<string, Dish[]>;

        // Task 1: Strict Category Filtering for 'Slim'
        const isSlim = packageType.toLowerCase() === 'slim';
        const allowedCategories = isSlim ? ['breakfast', 'lunch', 'dinner'] : ['breakfast', 'lunch', 'snack', 'dinner'];

        allowedCategories.forEach(category => {
          const selectionIndex = (day.selections as Record<string, number>)[category];
          const categoryDishes = dishes[category];
          
          if (Array.isArray(categoryDishes) && typeof selectionIndex === "number" && categoryDishes[selectionIndex]) {
            const dish = categoryDishes[selectionIndex];
            let dishName = typeof dish === "object" && dish !== null ? dish.short || dish.full || dish.name : dish;

            if (dishName) {
              dishName = String(dishName).trim();
              const isExtendedPlan = ['Active', 'Sport'].some(p => packageType.includes(p));
              if (isExtendedPlan && ['lunch', 'dinner'].includes(category)) {
                if (!dishName.includes('(1,5)')) dishName += " (1,5)";
              }
              allDishes.push(dishName);
            }
          }
        });
      } catch (e) {
        console.error("Error formatting standard dishes", e);
      }
    }
  }

  return allDishes.join(" + ");
}

/**
 * Export orders to Google Sheets with date-specific filtering and Sushka fix.
 */
export async function exportToKitchenSheet(
  targetDateStr: string
): Promise<ExportToKitchenSheetResult> {
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) return { ok: false, message: "Недостатньо прав для експорту." };

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.EXTERNAL_SHEET_ID;

  if (!clientEmail || !privateKey || !sheetId) {
    return { ok: false, message: "Не налаштовано Google Sheets API." };
  }

  const dateRange = parseTargetDate(targetDateStr);
  if (!dateRange) return { ok: false, message: "Некоректний формат дати DD.MM" };

  // CRITICAL: Determine day of week strictly from the TARGET date.
  const startDay = dateRange.start;
  const midDay = new Date(startDay.getTime() + 12 * 60 * 60 * 1000);
  let targetDayOfWeek = midDay.getUTCDay(); // 0 (Sun) - 6 (Sat)
  targetDayOfWeek = targetDayOfWeek === 0 ? 7 : targetDayOfWeek;

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // Task 2: Find all active orders that might cover the target date
    const allActiveOrders = await prisma.order.findMany({
      where: {
        deliveryDate: { lte: dateRange.end },
        status: { notIn: ["cancelled", "archived"] },
      },
      include: { user: true },
    });

    const kyivISO = { timeZone: 'Europe/Kiev', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
    const targetStr = new Intl.DateTimeFormat('en-CA', kyivISO).format(dateRange.start);
    const t = new Date(targetStr);

    // Filter orders to only those that actually have a delivery on targetDate
    const orders = allActiveOrders.filter(order => {
      if (!order.items || typeof order.items !== "object") return false;
      const days = (order.items as unknown as Record<string, unknown[]>).days;
      if (!Array.isArray(days)) return false;

      const startStr = new Intl.DateTimeFormat('en-CA', kyivISO).format(new Date(order.deliveryDate));
      const s = new Date(startStr);
      const dayIndex = Math.floor((t.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));

      return dayIndex >= 0 && dayIndex < days.length;
    });

    if (orders.length === 0) return { ok: false, message: `Не знайдено замовлень на ${targetDateStr}.` };

    // Fetch all relevant Menu records
    const dayIds = new Set<string>();
    for (const order of orders) {
      if (order.items && typeof order.items === "object") {
        const days = (order.items as unknown as Record<string, OrderDay[]>).days;
        if (Array.isArray(days)) {
          days.forEach((d) => d?.dayId && dayIds.add(d.dayId));
        }
      }
    }

    // Fetch fallback menus for this day (Template and Sushka)
    const dayMenus = await prisma.menu.findMany({
      where: {
        dayOfWeek: targetDayOfWeek,
        packageType: { in: ["Template", "Sushka"] }
      },
      select: { id: true, dishes: true, packageType: true }
    });

    const menus = await prisma.menu.findMany({
      where: { id: { in: Array.from(dayIds) } },
      select: { id: true, dishes: true, packageType: true },
    });

    const menuById = new Map([...menus, ...dayMenus].map((m) => [m.id, m]));
    const templateMenu = dayMenus.find(m => m.packageType === "Template");
    const sushkaMenu = dayMenus.find(m => m.packageType === "Sushka");

    const existingDataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${targetDateStr}'!C5:C300`,
    });

    let firstEmptyRow = 5;
    const existingValues = existingDataResponse.data.values;
    if (existingValues && existingValues.length > 0) {
      const emptyIndex = existingValues.findIndex((row) => !row[0] || String(row[0]).trim() === "");
      firstEmptyRow = 5 + (emptyIndex !== -1 ? emptyIndex : existingValues.length);
    }

    const rows: string[][] = await Promise.all(
      orders.map(async (order) => {
        let formattedDishes = "";
        const pkgLower = order.packageType.toLowerCase();
        const isSushka = pkgLower.includes("sushka");
        const isIndiv = pkgLower.includes("ind");
        const isExtendedPlan = pkgLower.includes("active") || pkgLower.includes("sport");
        
        if (isSushka) {
          // Format Sushka dishes
          const menu = sushkaMenu;
          if (menu) {
            try {
              const dishes = (typeof menu.dishes === "string" ? JSON.parse(menu.dishes) : menu.dishes) as Record<string, Dish[]>;
              const names: string[] = [];
              const isXS = pkgLower.includes("xs");
              
              ['breakfast', 'lunch', 'dinner', 'snack'].forEach(cat => {
                if (isXS && cat === 'snack') return;
                const d = dishes[cat]?.[0];
                const name = typeof d === "object" ? d.short || d.full : d;
                if (name) names.push(String(name).trim());
              });
              formattedDishes = names.join(" + ");
            } catch {
              formattedDishes = "Помилка парсингу меню Sushka";
            }
          } else {
            formattedDishes = "Меню Sushka не знайдено";
          }
        } else {
          // Try to format from order items
          formattedDishes = await formatOrderDishes(order.items, menuById, order.packageType, startDay, order.deliveryDate);
          
          // Fallback to Template menu if empty and NOT an Indiv package
          if (!formattedDishes && !isIndiv && templateMenu) {
            try {
              const dishes = (typeof templateMenu.dishes === "string" ? JSON.parse(templateMenu.dishes) : templateMenu.dishes) as Record<string, Dish[]>;
              const names: string[] = [];
              const isSlim = order.packageType.toLowerCase() === 'slim';
              const allowedCategories = isSlim ? ['breakfast', 'lunch', 'dinner'] : ['breakfast', 'lunch', 'snack', 'dinner'];

              allowedCategories.forEach(cat => {
                const d = dishes[cat]?.[0];
                let dishName = typeof d === "object" ? d.short || d.full : d;
                if (dishName) {
                  dishName = String(dishName).trim();
                  if (isExtendedPlan && ['lunch', 'dinner'].includes(cat)) {
                    if (!dishName.includes('(1,5)')) dishName += " (1,5)";
                  }
                  names.push(dishName);
                }
              });
              formattedDishes = names.join(" + ");
            } catch {
              // Ignore fallback errors
            }
          }

          if (!formattedDishes && isIndiv) {
            formattedDishes = "Пусто (Indiv)";
          }
        }

        // Task 1: Strict Priority for Price Display
        let dailyPrice: string;
        if (order.price === 0 || !order.price) {
          dailyPrice = "Абонемент";
        } else if (order.packageType.toLowerCase().includes('indiv')) {
          dailyPrice = "Індивідуально";
        } else {
          dailyPrice = order.price.toString();
        }

        const cleanPhone = normalizePhoneForLegacy(order.user.phone || "");
        const sheetPhone = cleanPhone ? "'" + cleanPhone : "";

        return [
          order.user.name || "", // C
          sheetPhone, // D (Add apostrophe to preserve 0)
          order.user.address || "", // E
          order.user.chatId || "", // F
          order.packageType || "", // G
          formattedDishes || "Меню не знайдено", // H
          order.cutlery ? `${order.cutlery} шт` : "0 шт", // I
          order.deliveryNote || "", // J
          dailyPrice, // K
        ];
      })
    );

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${targetDateStr}'!C${firstEmptyRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });

    await prisma.order.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { status: "Передано в учёт" },
    });

    return { ok: true, exported: orders.length };
  } catch (error) {
    const err = error as { 
      response?: { data?: { error?: { message?: string } } }; 
      message?: string; 
      code?: number;
    };
    console.error("Export error:", err);

    // Task 2: Specific Error Reporting for Google Sheets
    const errorBody = err.response?.data?.error?.message || err.message || "";

    if (
      errorBody.includes("requested entity was not found") ||
      errorBody.includes("Worksheet not found") ||
      errorBody.includes("Unable to parse range") ||
      err.code === 400
    ) {
      return { ok: false, message: "Вкладка для цієї дати не знайдена в Google Таблиці." };
    } else if (err.code === 403 || err.code === 401) {
      return { ok: false, message: "Помилка авторизації Google Sheets. Перевірте доступ сервісного акаунта." };
    } else if (err.code === 404) {
      return { ok: false, message: "Google Таблицю не знайдено. Перевірте EXTERNAL_SHEET_ID." };
    }

    return { ok: false, message: "Помилка експорту." };
  }
}

