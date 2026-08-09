import { google } from "googleapis";
import prisma from "./prisma";
import { parseIndivDishId } from "./order-selection";
import { Menu, Order, User } from "@prisma/client";
import { OrderCartData } from "@/app/actions/order-impl";

/**
 * Normalizes a phone number to the strict legacy format: 0XXXXXXXXX
 * - Strips non-digits
 * - Handles 9-digit (adds 0), 10-digit (keeps), and 12-digit (strips 38)
 */
export function normalizePhoneForLegacy(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 9) {
    return "0" + digits;
  }

  if (digits.length === 12 && digits.startsWith("380")) {
    return digits.slice(2);
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    return digits;
  }

  return digits;
}

export type ClientProfileSyncData = {
  name: string;
  phone: string;
  address: string;
  chatId?: string | null;
  packageType: string;
  cutlery: number;
  notes: string;
};

/**
 * Synchronizes client profile to the "Info" tab of the CRM Google Sheet.
 */
export async function syncClientToSheet(profileData: ClientProfileSyncData): Promise<void> {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    console.error("syncClientToSheet: Missing Google API environment variables.");
    return;
  }

  const normalizedPhone = normalizePhoneForLegacy(profileData.phone);

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Info!A:H",
    });

    const rows = response.data.values || [];
    let foundRowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      const rowPhone = normalizePhoneForLegacy(String(rows[i][2] || ""));
      if (rowPhone === normalizedPhone) {
        foundRowIndex = i + 1;
        break;
      }
    }

    const rowData = [
      "", // A: Номер зам
      profileData.name, // B: ПІБ
      normalizedPhone, // C: Телефон
      profileData.address, // D: Адреса
      profileData.chatId || "", // E: Chat id
      profileData.packageType, // F: Пакет
      profileData.cutlery.toString(), // G: Прибори
      profileData.notes, // H: Особливості
    ];

    if (foundRowIndex !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Info!A${foundRowIndex}:H${foundRowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowData],
        },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Info!A:H",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowData],
        },
      });
    }
  } catch (error) {
    console.error("syncClientToSheet failed:", error);
  }
}

const UKRAINIAN_DAYS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

type Ymd = { year: number; month: number; day: number };

function kyivYmd(date: Date): Ymd {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

function addCalendarDays(base: Ymd, days: number): Ymd {
  const date = new Date(Date.UTC(base.year, base.month - 1, base.day, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function formatCrmYmd({ year, month, day }: Ymd): string {
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")} (${UKRAINIAN_DAYS[weekday]})`;
}

function formatCrmDate(date: Date): string {
  return formatCrmYmd(kyivYmd(date));
}

function getMondayYmd(date: Date): Ymd {
  const ymd = kyivYmd(date);
  const weekday = new Date(
    Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12),
  ).getUTCDay();
  return addCalendarDays(ymd, weekday === 0 ? -6 : 1 - weekday);
}

const CATEGORY_LABELS: Record<string, string> = {
  breakfast: "Сніданок",
  lunch: "Обід",
  dinner: "Вечеря",
  snack: "Перекус",
};

type Dish = {
  short?: string;
  full?: string;
  name?: string;
};

/**
 * Appends order to the "Orders" tab of the CRM Google Sheet.
 * Bypasses legacy scripts and appends one row per delivery day.
 */
export async function appendOrderToSheet(order: Order, user: User): Promise<void> {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    console.error("appendOrderToSheet: Missing Google API environment variables.");
    return;
  }

  try {
    const cartData = order.items as unknown as OrderCartData;
    if (!cartData || !Array.isArray(cartData.days)) return;

    // 1. Resolve menu items
    const dayIds = cartData.days.map((d) => d.dayId);
    const menus = await prisma.menu.findMany({
      where: { id: { in: dayIds } },
    });
    const menuById = new Map(menus.map((m: Menu) => [m.id, m]));

    // 2. Prepare rows
    const rows: string[][] = [];
    const createdAt = new Date(order.createdAt);
    const creationDateStr = formatCrmDate(createdAt);
    const creationTimeStr = createdAt.toLocaleTimeString("uk-UA", {
      hour12: false,
      timeZone: "Europe/Kyiv",
    });
    const baseDeliveryYmd = kyivYmd(new Date(order.deliveryDate));
    const weekStartStr = formatCrmYmd(
      getMondayYmd(new Date(order.deliveryDate)),
    );
    const normalizedPhone = normalizePhoneForLegacy(user.phone || "");
    const phoneCell = `'${normalizedPhone}`; // Prepend apostrophe
    const selectedDaysOfWeek = cartData.days
      .map((day) => menuById.get(day.dayId)?.dayOfWeek)
      .filter(
        (dayOfWeek): dayOfWeek is number => typeof dayOfWeek === "number",
      );
    const minDayOfWeek =
      selectedDaysOfWeek.length > 0 ? Math.min(...selectedDaysOfWeek) : null;

    for (let i = 0; i < cartData.days.length; i++) {
      const day = cartData.days[i];

      const dayDishes: string[] = [];
      const menu = menuById.get(day.dayId);
      const deliveryOffset =
        menu && minDayOfWeek !== null ? menu.dayOfWeek - minDayOfWeek : i;
      const deliveryYmd = addCalendarDays(baseDeliveryYmd, deliveryOffset);

      if (menu) {
        const dishesJson = (typeof menu.dishes === "string" ? JSON.parse(menu.dishes) : menu.dishes) as Record<string, (string | Dish)[]>;
        
        // Custom/Indiv mode
        if (Array.isArray(day.items)) {
          for (const item of day.items) {
            const parsed = parseIndivDishId(item.dishId);
            if (parsed) {
              const catDishes = dishesJson[parsed.category];
              const dish = Array.isArray(catDishes) ? catDishes[parsed.index] : null;
              const dishName = typeof dish === "object" && dish !== null ? dish.short || dish.full || dish.name : dish;
              dayDishes.push(`${CATEGORY_LABELS[parsed.category] || parsed.category}: ${dishName} (x${item.quantity})`);
            }
          }
        } 
        // Standard mode
        else if (day.selections) {
          Object.entries(day.selections).forEach(([category, index]) => {
            const catDishes = dishesJson[category];
            const dish = Array.isArray(catDishes) ? catDishes[index] : null;
            const dishName = typeof dish === "object" && dish !== null ? dish.short || dish.full || dish.name : dish;
            if (dishName) {
              dayDishes.push(`${CATEGORY_LABELS[category] || category}: ${dishName}`);
            }
          });
        }
      }

      rows.push([
        phoneCell, // A: Phone
        user.chatId || "", // B: Telegram Chat ID (Legacy: Chat id)
        creationDateStr, // C: CreationDate
        weekStartStr, // D: WeekStart
        formatCrmYmd(deliveryYmd), // E: DeliveryDate
        order.packageType, // F: PackageType
        dayDishes.join("\n"), // G: OrderSummary
        "1", // H: Count
        creationTimeStr, // I: Time
        "Новий", // J: Status
        order.isPaid ? "TRUE" : "FALSE", // K: IsPaid
        order.cutlery > 0 ? `${order.cutlery} шт` : "—", // L: Cutlery
        order.notes || "—", // M: Notes
        user.name, // N: ClientName
      ]);
    }

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Orders!A:N",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows,
      },
    });

    console.log(`appendOrderToSheet: Appended ${rows.length} rows for order ${order.id}`);
  } catch (error) {
    console.error("appendOrderToSheet failed:", error);
  }
}
