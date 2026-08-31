import { sheets_v4 } from "googleapis";
import prisma from "./prisma";
import { parseIndivDishId, isIndivPackage } from "./order-selection";
import { normalizePhoneForLegacy } from "./googleSheets";
import { createGoogleSheetsClient } from "./google-sheets-auth";
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
 * runs as a post-commit side-effect AFTER an order has been persisted — a
 * missing month config (admin forgot to add next month) never
 * fails the customer checkout; it is surfaced via the Telegram warning prefix
 * and the proactive cron alert instead.
 */

const TEMPLATE_TAB = "_Template";
const DATA_START_ROW = 5;
const FIRST_COL = "B";
const LAST_COL = "L";

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
 * `deliveryDate` is the earliest selected weekday. Use each menu row's real
 * weekday offset so non-consecutive picks (for example Monday + Thursday) do
 * not accidentally land in Monday + Tuesday tabs.
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
  const selectedDaysOfWeek = cartData.days
    .map((day: OrderCartDay) => menuById.get(day.dayId)?.dayOfWeek)
    .filter((dayOfWeek: number | undefined): dayOfWeek is number =>
      typeof dayOfWeek === "number",
    );
  const minDayOfWeek =
    selectedDaysOfWeek.length > 0 ? Math.min(...selectedDaysOfWeek) : null;

  return cartData.days.map((day: OrderCartDay, index: number) => {
    const menu = menuById.get(day.dayId);
    const dateOffset =
      menu && minDayOfWeek !== null ? menu.dayOfWeek - minDayOfWeek : index;
    const ymd = addDays(baseYmd, dateOffset);
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

function singleLineCell(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** Build columns B–L for one order/day. Column B derives its number from the appended row. */
function buildRow(order: Order, user: User, orderDay: OrderDay): string[] {
  const normalizedPhone = normalizePhoneForLegacy(user.phone || "");
  return [
    "=ROW()-4", // B: Race-safe sequential number for data rows starting at row 5
    singleLineCell(user.name), // C: User Name
    `'${normalizedPhone}`, // D: Phone (apostrophe keeps the leading zero)
    singleLineCell(order.deliveryAddress || user.address), // E: Address
    singleLineCell(user.chatId), // F: Telegram Chat ID
    singleLineCell(order.packageType), // G: Package Name
    orderDay.dishes, // H: Dishes
    order.cutlery > 0 ? `${order.cutlery} шт` : "", // I: Cutlery count
    (order.notes || user.notes || "").trim(), // J: Comments / Notes
    priceCell(order, orderDay.isCustom), // K: Price
    order.id, // L: OrderId (Idempotency Key)
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
  return createGoogleSheetsClient();
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

  let batchResponse: sheets_v4.Schema$BatchUpdateSpreadsheetResponse;
  try {
    batchResponse = (
      await sheets.spreadsheets.batchUpdate({
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
      })
    ).data;
  } catch (error) {
    // Two checkouts can discover a missing day tab at the same time. If the
    // other request created it first, recover that tab instead of dropping this
    // order's export because Google rejected the duplicate title.
    const refreshed = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const createdByPeer = refreshed.data.sheets?.find(
      (sheet) => sheet.properties?.title === tabName,
    )?.properties?.sheetId;
    if (createdByPeer != null) return createdByPeer;
    throw error;
  }

  const newSheetId =
    batchResponse.replies?.[0]?.duplicateSheet?.properties?.sheetId ?? null;

  // Stamp the localized date into B2 of the freshly created tab.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!B2`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[localizedDate]] },
  });

  return newSheetId;
}

function appendedRowNumber(updatedRange: string | null | undefined): number | null {
  const match = updatedRange?.match(/![A-Z]+(\d+):[A-Z]+\d+$/);
  if (!match) return null;
  const row = Number(match[1]);
  return Number.isInteger(row) && row >= DATA_START_ROW ? row : null;
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

          // Check for idempotency
          const existingResp = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${day.tabName}!L:L`,
          });
          const existingIds = (existingResp.data.values || []).map(r => r[0]);
          if (existingIds.includes(order.id)) {
            console.log(`syncOrderToMonthlySheets: order ${order.id} already exists in ${day.tabName}, skipping.`);
            continue;
          }

          const row = buildRow(order, user, day);

          // `append` asks Sheets to resolve the next table row server-side. The
          // former count-then-update sequence allowed simultaneous checkouts to
          // choose the same row and overwrite one another.
          const appendResponse = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${day.tabName}!${FIRST_COL}4:${LAST_COL}`,
            valueInputOption: "USER_ENTERED",
            insertDataOption: "OVERWRITE",
            requestBody: { values: [row] },
          });
          const targetRow = appendedRowNumber(
            appendResponse.data.updates?.updatedRange,
          );

          // The day tab inherits column widths + wrapping from `_Template`.
          // Resize only the row that was just written so long dishes/comments
          // remain readable without expanding columns across the whole screen.
          if (targetRow != null) {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    autoResizeDimensions: {
                      dimensions: {
                        sheetId,
                        dimension: "ROWS",
                        startIndex: targetRow - 1,
                        endIndex: targetRow,
                      },
                    },
                  },
                ],
              },
            });
          }

          console.log(
            `syncOrderToMonthlySheets: order ${order.id} → ${monthKey}/${day.tabName} row ${targetRow ?? "appended"}.`,
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

/**
 * Strikes through and highlights an order's row in red to mark it as cancelled.
 * It searches the 'L' column (OrderId) on the specified tab.
 */
export async function markOrderCancelledInSheet(
  orderId: string,
  monthKey: string,
  tabName: string
): Promise<void> {
  try {
    const sheets = getSheetsClient();
    if (!sheets) return;

    const spreadsheetId = await getSheetIdForMonth(monthKey);
    if (!spreadsheetId) {
      console.warn(`markOrderCancelledInSheet: no sheet for ${monthKey}.`);
      return;
    }

    // Resolve sheetId for formatting
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const sheetId = meta.data.sheets?.find(
      (s: sheets_v4.Schema$Sheet) => s.properties?.title === tabName
    )?.properties?.sheetId;

    if (sheetId == null) {
      console.warn(`markOrderCancelledInSheet: tab ${tabName} not found.`);
      return;
    }

    // Find the row by OrderId in column L
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!L:L`,
    });

    const rows = response.data.values || [];
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === orderId) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      console.warn(`markOrderCancelledInSheet: order ${orderId} not found in ${tabName}.`);
      return;
    }

    // Apply red background and strikethrough
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: rowIndex,
                endRowIndex: rowIndex + 1,
                startColumnIndex: 1, // Column B (index 1)
                endColumnIndex: 12, // Column L (index 11 + 1)
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 1.0, green: 0.9, blue: 0.9 }, // Light red
                  textFormat: { strikethrough: true },
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
        ],
      },
    });

    console.log(`markOrderCancelledInSheet: marked order ${orderId} in ${tabName} row ${rowIndex + 1}.`);
  } catch (error) {
    console.error("markOrderCancelledInSheet failed:", error);
  }
}
