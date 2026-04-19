"use server";

import { google } from "googleapis";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";

export type ExportToKitchenSheetResult =
  | {
      ok: true;
      exported: number;
    }
  | {
      ok: false;
      message: string;
    };

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
 * 2. Fetch orders for target date (excluding already exported)
 * 3. Calculate first empty row (data starts at row 5)
 * 4. Format each order as a 9-column row (C through K)
 * 5. Update the sheet using update API (not append)
 * 6. Mark orders as exported
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
