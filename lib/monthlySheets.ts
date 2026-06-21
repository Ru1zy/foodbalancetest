import { google, sheets_v4 } from "googleapis";
import prisma from "./prisma";
import { parseIndivDishId, isIndivPackage } from "./order-selection";
import { normalizePhoneForLegacy } from "./googleSheets";
import type { Menu, Order, User } from "@prisma/client";
import type { OrderCartData, OrderCartDay } from "@/app/actions/order-impl";

/**
 * Real-time, month-keyed Google Sheets export.
 *
 * Each calendar month has its OWN spreadsheet, identified by a `MM.YYYY` key
 * stored in the `SheetConfig` table (e.g. `03.2026 -> 1A2B3C...`). Inside that
 * spreadsheet every delivery DAY gets its own tab named `DD.MM` (e.g. `14.02`),
 * cloned on demand from a `_Template` tab. One row per order/day is appended
 * starting at row 5, columns B–K.
 *
 * This module is the autonomous replacement for the manual batch process and
 * is designed to be fired as a non-blocking side-effect AFTER an order has been
 * persisted — a missing month config (admin forgot to add next month) never
 * fails the customer checkout; it is surfaced via the Telegram warning prefix
 * and the proactive cron alert instead.
 */

const TEMPLATE_TAB = "_Template";
const DATA_START_ROW = 5;
const FIRST_COL = "B";
const LAST_COL = "K";

const UA_MONTHS_GENITIVE = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

const UA_WEEKDAYS = [
  "Неділя",
  "Понеділок",
  "Вівторок",
  "Середа",
  "Четвер",
  "Пʼятниця",
  "Субота",
];

const CATEGORY_ORDER = ["breakfast", "lunch", "dinner", "snack", "extra"];

type Ymd = { year: number; month: number; day: number };

type Dish = {
  short?: string;
  full?: string;
  name?: string;
};

/** One delivery day resolved from an order's cart. */
type OrderDay = {
  ymd: Ymd;
  /** `MM.YYYY` lookup key for the month spreadsheet. */
  monthKey: string;
  /** `DD.MM` tab name inside the month spreadsheet. */
  tabName: string;
  /** Human, Ukrainian-localized date string written into B2. */
  localizedDate: string;
  /** Formatted dishes string for this day, e.g. "Омлет (x1) + Тост (x1)". */
  dishes: string;
  /** Whether this day was assembled individually / custom. */
  isCustom: boolean;
};

// ---------------------------------------------------------------------------
// Pure date helpers (calendar arithmetic — no timezone roll risk)
// ---------------------------------------------------------------------------

/** Europe/Kyiv calendar Y/M/D for an instant (DST-aware). */
function kyivYmd(date: Date): Ymd {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [year, month, day] = key.split("-").map((part: string) => Number(part));
  return { year, month, day };
}

/** Add `n` calendar days to a Y/M/D (noon-UTC anchor avoids DST day-rolls). */
function addDays(base: Ymd, n: number): Ymd {
  const dt = new Date(Date.UTC(base.year, base.month - 1, base.day, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + n);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

function monthKeyFromYmd({ month, year }: Ymd): string {
  return `${String(month).padStart(2, "0")}.${year}`;
}

function tabNameFromYmd({ day, month }: Ymd): string {
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}`;
}

function localizedDateFromYmd({ day, month, year }: Ymd): string {
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return `${day} ${UA_MONTHS_GENITIVE[month - 1]} ${year} р. (${UA_WEEKDAYS[weekdayIndex]})`;
}

// ---------------------------------------------------------------------------
// Cart / dish resolution
// ---------------------------------------------------------------------------

function dishLabel(dish: string | Dish | null | undefined): string {
  if (dish == null) return "";
  if (typeof dish === "string") return dish;
  return dish.short || dish.full || dish.name || "";
}

/** Build the "Name (xN) + Name (xN)" dishes string for a single cart day. */
function formatDayDishes(day: OrderCartDay, menu: Menu | undefined): string {
  if (!menu) return "";

  const dishesJson = (typeof menu.dishes === "string"
    ? JSON.parse(menu.dishes)
    : menu.dishes) as Record<string, (string | Dish)[]>;

  const parts: string[] = [];

  // Custom / Individual assembly: explicit portion items with quantities.
  if (Array.isArray(day.items) && day.items.length > 0) {
    for (const item of day.items) {
      const parsed = parseIndivDishId(item.dishId);
      if (!parsed) continue;
      const catDishes = dishesJson[parsed.category];
      const name = dishLabel(Array.isArray(catDishes) ? catDishes[parsed.index] : null);
      if (name) parts.push(`${name} (x${item.quantity})`);
    }
    return parts.join(" + ");
  }

  // Standard mode: one pick per category (qty 1).
  if (day.selections) {
    for (const category of CATEGORY_ORDER) {
      const index = day.selections[category];
      if (index === undefined) continue;
      const catDishes = dishesJson[category];
      const name = dishLabel(Array.isArray(catDishes) ? catDishes[index] : null);
      if (name) parts.push(`${name} (x1)`);
    }
  }

  return parts.join(" + ");
}

/**
 * Resolve every delivery day of an order into the data needed to write its row.
 * Mirrors the legacy per-day unrolling: cart `days[i]` lands on
 * `deliveryDate + i` calendar days.
 */
async function resolveOrderDays(order: Order): Promise<OrderDay[]> {
  const cartData = order.items as unknown as OrderCartData;
  if (!cartData || !Array.isArray(cartData.days) || cartData.days.length === 0) {
    return [];
  }

  const dayIds = cartData.days
    .map((d: OrderCartDay) => d.dayId)
    .filter((id: string) => typeof id === "string" && id.length > 0);

  const menus = await prisma.menu.findMany({ where: { id: { in: dayIds } } });
  const menuById = new Map(menus.map((m: Menu) => [m.id, m]));

  const baseYmd = kyivYmd(new Date(order.deliveryDate));

  return cartData.days.map((day: OrderCartDay, index: number) => {
    const ymd = addDays(baseYmd, index);
    const menu = menuById.get(day.dayId);
    const isCustom =
      isIndivPackage(order.packageType) || (Array.isArray(day.items) && day.items.length > 0);
    return {
      ymd,
      monthKey: monthKeyFromYmd(ymd),
      tabName: tabNameFromYmd(ymd),
      localizedDate: localizedDateFromYmd(ymd),
      dishes: formatDayDishes(day, menu),
      isCustom,
    };
  });
}

/**
 * Price cell (column K):
 *   - "Абонемент"     when the order drew from a subscription balance
 *   - "Індивідуально" when the package / day is a custom (individual) selection
 *   - otherwise the actual numeric total price
 */
function priceCell(order: Order, isCustom: boolean): string {
  if (order.balanceDaysUsed > 0) return "Абонемент";
  if (isCustom || isIndivPackage(order.packageType)) return "Індивідуально";
  return order.price != null ? String(order.price) : "";
}

/** Build columns B–K for one order/day (B sequence number filled in later). */
function buildRow(order: Order, user: User, orderDay: OrderDay, sequence: number): string[] {
  const normalizedPhone = normalizePhoneForLegacy(user.phone || "");
  return [
    String(sequence), // B: Sequential order number for the day
    user.name || "", // C: User Name
    `'${normalizedPhone}`, // D: Phone (apostrophe keeps the leading zero)
    order.deliveryAddress || user.address || "", // E: Address
    user.chatId || "", // F: Telegram Chat ID
    order.packageType, // G: Package Name
    orderDay.dishes, // H: Dishes
    order.cutlery > 0 ? `${order.cutlery} шт` : "", // I: Cutlery count
    order.notes || user.notes || "", // J: Comments / Notes
    priceCell(order, orderDay.isCustom), // K: Price
  ];
}

// ---------------------------------------------------------------------------
// Config lookup
// ---------------------------------------------------------------------------

/** Spreadsheet ID for a `MM.YYYY` month, or null when not configured. */
export async function getSheetIdForMonth(monthKey: string): Promise<string | null> {
  try {
    const cfg = await prisma.sheetConfig.findUnique({ where: { monthKey } });
    return cfg?.spreadsheetId?.trim() || null;
  } catch (error) {
    console.error(`getSheetIdForMonth(${monthKey}) failed:`, error);
    return null;
  }
}

/**
 * True when ANY delivery day of the order falls in a month that has no
 * configured spreadsheet. Drives the reactive Telegram warning prefix.
 */
export async function orderHasMissingSheetConfig(order: Order): Promise<boolean> {
  try {
    const days = await resolveOrderDays(order);
    const monthKeys = Array.from(new Set(days.map((d) => d.monthKey)));
    if (monthKeys.length === 0) return false;
    for (const monthKey of monthKeys) {
      const id = await getSheetIdForMonth(monthKey);
      if (!id) return true;
    }
    return false;
  } catch (error) {
    console.error("orderHasMissingSheetConfig failed:", error);
    // Never block / mislabel checkout because of a lookup error.
    return false;
  }
}

// ---------------------------------------------------------------------------
// Google Sheets writes
// ---------------------------------------------------------------------------

function getSheetsClient(): sheets_v4.Sheets | null {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    console.error("monthlySheets: Missing Google API environment variables.");
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

/**
 * Ensure a `DD.MM` tab exists in the spreadsheet. If missing, duplicate the
 * `_Template` tab, rename it and stamp the localized date into B2. Returns the
 * resolved sheetId, or null if the template is missing.
 */
async function ensureDayTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string,
  localizedDate: string,
): Promise<number | null> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });

  const allSheets: sheets_v4.Schema$Sheet[] = meta.data.sheets || [];
  const existing = allSheets.find(
    (s: sheets_v4.Schema$Sheet) => s.properties?.title === tabName,
  );
  if (existing && existing.properties?.sheetId != null) {
    return existing.properties.sheetId;
  }

  const template = allSheets.find(
    (s: sheets_v4.Schema$Sheet) => s.properties?.title === TEMPLATE_TAB,
  );
  if (!template || template.properties?.sheetId == null) {
    console.error(
      `monthlySheets: "${TEMPLATE_TAB}" tab not found in spreadsheet ${spreadsheetId}; cannot create "${tabName}".`,
    );
    return null;
  }

  const batchResponse = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          duplicateSheet: {
            sourceSheetId: template.properties.sheetId,
            newSheetName: tabName,
          },
        },
      ],
    },
  });

  const newSheetId =
    batchResponse.data.replies?.[0]?.duplicateSheet?.properties?.sheetId ?? null;

  // Stamp the localized date into B2 of the freshly created tab.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!B2`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[localizedDate]] },
  });

  return newSheetId;
}

/** Count existing data rows (from row 5) in column B of a tab. */
async function countDataRows(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string,
): Promise<number> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!${FIRST_COL}${DATA_START_ROW}:${FIRST_COL}`,
  });
  const rows = response.data.values || [];
  // Trailing empty cells are trimmed by the API, so length === filled rows.
  return rows.filter((r: unknown[]) => r && String(r[0] ?? "").trim().length > 0).length;
}

/**
 * Main side-effect: export every delivery day of an order into the correct
 * month spreadsheet / `DD.MM` tab. Months without a configured spreadsheet are
 * skipped silently (the Telegram warning + cron alert cover that case). Never
 * throws — failures are logged so they cannot roll back a persisted order.
 */
export async function syncOrderToMonthlySheets(order: Order, user: User): Promise<void> {
  try {
    const sheets = getSheetsClient();
    if (!sheets) return;

    const days = await resolveOrderDays(order);
    if (days.length === 0) return;

    // Group days by month so each spreadsheet is touched once.
    const byMonth = new Map<string, OrderDay[]>();
    for (const day of days) {
      const list = byMonth.get(day.monthKey) || [];
      list.push(day);
      byMonth.set(day.monthKey, list);
    }

    for (const [monthKey, monthDays] of byMonth) {
      const spreadsheetId = await getSheetIdForMonth(monthKey);
      if (!spreadsheetId) {
        console.warn(
          `syncOrderToMonthlySheets: no spreadsheet configured for ${monthKey} (order ${order.id}) — skipped.`,
        );
        continue;
      }

      for (const day of monthDays) {
        try {
          const sheetId = await ensureDayTab(
            sheets,
            spreadsheetId,
            day.tabName,
            day.localizedDate,
          );
          if (sheetId == null) continue;

          const existingRows = await countDataRows(sheets, spreadsheetId, day.tabName);
          const sequence = existingRows + 1;
          const targetRow = DATA_START_ROW + existingRows;
          const row = buildRow(order, user, day, sequence);

          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${day.tabName}!${FIRST_COL}${targetRow}:${LAST_COL}${targetRow}`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [row] },
          });

          console.log(
            `syncOrderToMonthlySheets: order ${order.id} → ${monthKey}/${day.tabName} row ${targetRow} (#${sequence}).`,
          );
        } catch (dayError) {
          console.error(
            `syncOrderToMonthlySheets: failed for ${monthKey}/${day.tabName} (order ${order.id}):`,
            dayError,
          );
        }
      }
    }
  } catch (error) {
    console.error("syncOrderToMonthlySheets failed:", error);
  }
}
