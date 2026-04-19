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
 * Joins dish names with " + " separator.
 */
function formatOrderDishes(items: unknown): string {
  if (!items || typeof items !== "object") return "";

  const days = (items as Record<string, unknown>).days;
  if (!Array.isArray(days) || days.length === 0) return "";

  // Collect all dish names from all days
  const allDishes: string[] = [];

  for (const day of days) {
    // Handle individual package items
    if (Array.isArray(day.items)) {
      for (const item of day.items) {
        const dishName = item.dishId || "";
        const quantity = item.quantity || 1;
        for (let i = 0; i < quantity; i++) {
          allDishes.push(dishName);
        }
      }
    }

    // Handle standard package selections
    if (day.selections && typeof day.selections === "object") {
      const categoryNames = Object.keys(day.selections);
      for (const category of categoryNames) {
        allDishes.push(category);
      }
    }
  }

  return allDishes.join(" + ");
}

/**
 * Simplified export function that appends orders to Google Sheets.
 *
 * Algorithm:
 * 1. Authenticate with Google Sheets API
 * 2. Fetch orders for target date (excluding already exported)
 * 3. Format each order as a 10-column row
 * 4. Append all rows to the sheet using append API
 * 5. Mark orders as exported
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

    // Fetch orders for the target date (excluding already exported)
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
        status: {
          not: "Передано в учёт",
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

    // Format orders into rows (columns A-J)
    const rows: string[][] = orders.map((order) => {
      const formattedDishes = formatOrderDishes(order.items);

      return [
        "", // Column A - empty
        "", // Column B - empty
        order.user.name, // Column C - Name
        order.user.phone, // Column D - Phone
        order.user.address || "", // Column E - Address
        order.user.chatId || "", // Column F - Chat ID
        order.packageType, // Column G - Package Type
        formattedDishes, // Column H - Dishes
        order.cutlery.toString(), // Column I - Cutlery
        order.notes || "", // Column J - Notes
      ];
    });

    // Append rows to the sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${targetDateStr}'`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: rows,
      },
    });

    // Mark orders as exported
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

    console.log(`Exported ${orders.length} orders to Google Sheets`);

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
