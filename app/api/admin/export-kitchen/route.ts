import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { google } from "googleapis";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { kyivDayRangeUtc } from "@/lib/order-logic";
import type { Prisma } from "@prisma/client";

type KitchenOrderWithUser = Prisma.OrderGetPayload<{
  include: { user: { select: { name: true; phone: true; address: true; chatId: true } } };
}>;

export const runtime = "nodejs";

async function parseOrderItems(items: unknown): Promise<string[]> {
  if (!items || typeof items !== "object") {
    return [];
  }

  const days = Reflect.get(items, "days");
  if (!Array.isArray(days) || days.length === 0) {
    return [];
  }

  const parsedItems: string[] = [];

  // Fetch menu items for all dayIds in this order
  const dayIds = days
    .map((day: unknown) => {
      if (day && typeof day === "object" && "dayId" in day) {
        return day.dayId;
      }
      return null;
    })
    .filter(Boolean) as string[];

  if (dayIds.length === 0) {
    return [];
  }

  const menuItems = await prisma.menu.findMany({
    where: {
      id: {
        in: dayIds,
      },
    },
    select: {
      id: true,
      dishes: true,
    },
  });

  const menuById = new Map(menuItems.map((item: { id: string; dishes: Prisma.JsonValue }) => [item.id, item]));

  const CATEGORY_LABELS: Record<string, string> = {
    breakfast: "Сніданок",
    lunch: "Обід",
    dinner: "Вечеря",
    snack: "Перекус",
    extra: "Додатково",
  };

  // Parse each day
  for (const day of days) {
    const selections = day.selections || {};
    const items = day.items || [];
    const menu = menuById.get(day.dayId);

    // Handle regular package selections
    if (Object.keys(selections).length > 0 && menu) {
      const dishes = typeof menu.dishes === "string" ? JSON.parse(menu.dishes) : menu.dishes;

      Object.entries(selections).forEach(([category, selectionIndex]) => {
        const categoryDishes = dishes[category];

        if (Array.isArray(categoryDishes) && categoryDishes[selectionIndex as number]) {
          const dish = categoryDishes[selectionIndex as number];
          const dishName =
            typeof dish === "object" && dish !== null
              ? dish.full || dish.short || dish.name
              : dish;
          if (dishName) {
            parsedItems.push(String(dishName).trim());
          }
        }
      });
    }

    // Handle individual package items
    if (items.length > 0) {
      items.forEach((item: unknown) => {
        if (item && typeof item === "object" && "dishId" in item) {
          const { dishId, quantity = 1 } = item as { dishId: string; quantity?: number };
          const separatorIndex = dishId.lastIndexOf(":");
          
          let displayLabel = dishId;
          if (separatorIndex > 0) {
            const cat = dishId.slice(0, separatorIndex);
            const idx = parseInt(dishId.slice(separatorIndex + 1));
            const label = CATEGORY_LABELS[cat] || cat;
            displayLabel = `${label} №${idx + 1}`;
          }

          for (let i = 0; i < quantity; i++) {
            parsedItems.push(displayLabel.trim());
          }
        }
      });
    }
  }

  return parsedItems;
}

export async function GET(request: Request) {
  try {
    const adminUser = await getAuthenticatedAdminUser();
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const format = searchParams.get("format") || "csv"; // csv or sheets

    if (!date) {
      return NextResponse.json({ error: "Date parameter required" }, { status: 400 });
    }

    // `date` is the Kyiv delivery day as YYYY-MM-DD. Build the same DST-aware
    // Kyiv calendar-day window as /api/admin/today-orders so both endpoints
    // resolve to the *identical* set of orders regardless of server timezone
    // (Vercel runs UTC) and across the +02:00/+03:00 DST switch.
    const dateMatch = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!dateMatch) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }
    const exportYear = parseInt(dateMatch[1], 10);
    const exportMonth = parseInt(dateMatch[2], 10);
    const exportDay = parseInt(dateMatch[3], 10);
    const { start: startDate, end: endDate } = kyivDayRangeUtc(exportYear, exportMonth, exportDay);

    // Fetch paid orders for the date
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: startDate,
          lte: endDate,
        },
        isPaid: true,
      },
      include: {
        user: {
          select: {
            name: true,
            phone: true,
            address: true,
            chatId: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Parse all orders
    const exportData = await Promise.all(
      orders.map(async (order: KitchenOrderWithUser) => {
        const parsedItems = await parseOrderItems(order.items);
        const dishesString = parsedItems.join("+");

        // Get cutlery info
        let cutlery = order.cutlery || "";
        if (cutlery === "Без приборів" || cutlery === "—") {
          cutlery = "";
        }

        // Get notes
        let notes = order.notes || "";
        if (notes === "—") {
          notes = "";
        }

        return {
          name: order.user.name || "—",
          phone: order.user.phone ? `'${order.user.phone}` : "—",
          address: order.deliveryAddress || order.user.address || "—",
          chatId: order.user.chatId || "",
          packageType: order.packageType || "",
          dishes: dishesString,
          cutlery,
          notes,
        };
      })
    );

    if (format === "sheets") {
      // Google Sheets export
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

      if (!sheetId || !credentials) {
        return NextResponse.json(
          { error: "Google Sheets credentials not configured" },
          { status: 500 }
        );
      }

      try {
        const auth = new google.auth.GoogleAuth({
          credentials: JSON.parse(credentials),
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const sheets = google.sheets({ version: "v4", auth });

        // Format date as DD.MM for sheet name (derived from the parsed Kyiv
        // calendar date, not a TZ-dependent Date parse).
        const sheetName = `${String(exportDay).padStart(2, "0")}.${String(exportMonth).padStart(2, "0")}`;

        // Prepare rows for Google Sheets
        const rows = exportData.map((row) => [
          row.name,
          row.phone,
          row.address,
          row.chatId,
          row.packageType,
          row.dishes,
          row.cutlery,
          row.notes,
        ]);

        // Check if sheet exists, if not create it
        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId: sheetId,
        });

        const sheetExists = spreadsheet.data.sheets?.some(
          (sheet) => sheet.properties?.title === sheetName
        );

        if (!sheetExists) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: sheetName,
                    },
                  },
                },
              ],
            },
          });
        }

        // Write data to sheet
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${sheetName}!A1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [
              ["Клієнт", "Телефон", "Адреса", "Chat ID", "Пакет", "Страви", "Прибори", "Особливості"],
              ...rows,
            ],
          },
        });

        return NextResponse.json({
          success: true,
          message: `Exported ${exportData.length} orders to Google Sheets`,
          sheetName,
        });
      } catch (error) {
        console.error("Google Sheets error:", error);
        return NextResponse.json(
          { error: "Failed to export to Google Sheets" },
          { status: 500 }
        );
      }
    } else {
      // CSV export
      let csv = "\uFEFF"; // UTF-8 BOM
      csv += "Клієнт,Телефон,Адреса,Chat ID,Пакет,Страви,Прибори,Особливості\n";

      for (const row of exportData) {
        const escapeCsv = (str: string | number) => `"${String(str).replace(/"/g, '""')}"`;

        csv += [
          escapeCsv(row.name),
          escapeCsv(row.phone),
          escapeCsv(row.address),
          escapeCsv(row.chatId),
          escapeCsv(row.packageType),
          escapeCsv(row.dishes),
          escapeCsv(row.cutlery),
          escapeCsv(row.notes),
        ].join(",");
        csv += "\n";
      }

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="kitchen-${date}.csv"`,
        },
      });
    }
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
