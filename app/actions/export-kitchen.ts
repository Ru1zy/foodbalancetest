"use server";

import { google } from "googleapis";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";

export type ExportToKitchenSheetResult =
  | {
      ok: true;
      exported: number;
      unmatched: Array<{
        name: string;
        phone: string;
        userId: string;
      }>;
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
function formatOrderDishes(items: any): string {
  if (!items || typeof items !== "object") return "";

  const days = items.days;
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
 * Replicate the legacy exportToExternalSheet function.
 *
 * Algorithm:
 * 1. Authenticate with Google Sheets API
 * 2. Fetch the target sheet tab data
 * 3. Scan Column F (Chat ID) and Column H (Dishes) to find available slots
 * 4. Match orders by User ID (chatId) to available rows
 * 5. Batch update the sheet with order details
 * 6. Return unmatched orders for error display
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

    // Fetch orders for the target date
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
        OR: [
          { isPaid: true },
          { status: { in: ["Оплачено", "processed", "delivered"] } },
        ],
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
        message: `Не знайдено оплачених замовлень на ${targetDateStr}.`,
      };
    }

    // Fetch the target sheet tab
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${targetDateStr}!A:J`,
    });

    const rows = sheetData.data.values || [];

    // CRITICAL: Find available slots
    // Column F (index 5) = Chat ID
    // Column H (index 7) = Dishes
    // Available slot = Chat ID exists AND Dishes is empty
    const availableSlotsByUserId: Record<string, number[]> = {};

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const chatId = row[5]?.toString().trim(); // Column F
      const dishes = row[7]?.toString().trim(); // Column H

      if (chatId && !dishes) {
        // Available slot found
        if (!availableSlotsByUserId[chatId]) {
          availableSlotsByUserId[chatId] = [];
        }
        availableSlotsByUserId[chatId].push(i + 1); // Row number (1-indexed)
      }
    }

    // Prepare batch updates
    const batchUpdateData: any[] = [];
    const exportedOrderIds: string[] = [];
    const unmatchedOrders: Array<{ name: string; phone: string; userId: string }> = [];

    for (const order of orders) {
      const userId = order.user.chatId;

      if (!userId || !availableSlotsByUserId[userId] || availableSlotsByUserId[userId].length === 0) {
        // No available slot for this user
        unmatchedOrders.push({
          name: order.user.name,
          phone: order.user.phone,
          userId: userId || order.user.id,
        });
        continue;
      }

      // Get the first available row for this user
      const rowNumber = availableSlotsByUserId[userId].shift()!;

      // Format dishes
      const formattedDishes = formatOrderDishes(order.items);

      // Prepare data for columns C:E (Name, Phone, Address)
      batchUpdateData.push({
        range: `${targetDateStr}!C${rowNumber}:E${rowNumber}`,
        values: [[
          order.user.name,
          order.user.phone,
          order.user.address || "",
        ]],
      });

      // Prepare data for columns G:J (Package, Dishes, Cutlery, Notes)
      batchUpdateData.push({
        range: `${targetDateStr}!G${rowNumber}:J${rowNumber}`,
        values: [[
          order.packageType,
          formattedDishes,
          order.cutlery.toString(),
          order.notes || "",
        ]],
      });

      exportedOrderIds.push(order.id);
    }

    // Execute batch update
    if (batchUpdateData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: batchUpdateData,
        },
      });

      // Mark orders as exported (optional: add a field to track this)
      // For now, we'll just log it
      console.log(`Exported ${exportedOrderIds.length} orders to Google Sheets`);
    }

    return {
      ok: true,
      exported: exportedOrderIds.length,
      unmatched: unmatchedOrders,
    };
  } catch (error) {
    console.error("exportToKitchenSheet failed", error);

    return {
      ok: false,
      message: error instanceof Error ? error.message : "Не вдалося експортувати в Google Sheets.",
    };
  }
}
