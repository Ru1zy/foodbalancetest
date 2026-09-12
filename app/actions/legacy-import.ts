"use server";

import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { createGoogleSheetsClient } from "@/lib/google-sheets-auth";
import { normalizePhone } from "@/lib/phone-utils";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type ImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

// ---------------------------------------------------------------------------
// Import Clients from Google Sheet → PostgreSQL
// ---------------------------------------------------------------------------

/**
 * Reads the "Info" tab (columns A–H) from the CRM Google Sheet and upserts
 * each client row into the `User` table. Matching is by normalized phone.
 *
 * Sheet columns:
 *   A: Номер зам (ignored)
 *   B: ПІБ (name)
 *   C: Телефон (phone)
 *   D: Адреса (address)
 *   E: Chat id (chatId)
 *   F: Пакет (defaultPackage)
 *   G: Прибори (defaultCutlery)
 *   H: Особливості (notes)
 */
export async function importClientsFromSheet(): Promise<ImportResult> {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) return { ok: false, created: 0, updated: 0, skipped: 0, errors: ["Доступ заборонено"] };

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheets = createGoogleSheetsClient();

  if (!sheets || !spreadsheetId) {
    return { ok: false, created: 0, updated: 0, skipped: 0, errors: ["Google Sheets не налаштовано (GOOGLE_SHEET_ID / credentials)"] };
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Info!A:H",
    });

    const rows = resp.data.values || [];
    if (rows.length <= 1) {
      return { ok: true, created: 0, updated: 0, skipped: 0, errors: ["Таблиця порожня (лише заголовок)"] };
    }

    // Process rows (skip header row 0)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawPhone = String(row[2] || "").trim();
      const name = String(row[1] || "").trim();

      if (!rawPhone || !name) {
        skipped++;
        continue;
      }

      const phone = normalizePhone(rawPhone);

      // Phone must be a valid 10-digit UA number
      if (!/^0\d{9}$/.test(phone)) {
        skipped++;
        errors.push(`Рядок ${i + 1}: невалідний телефон "${rawPhone}"`);
        continue;
      }

      const address = String(row[3] || "").trim() || null;
      const chatId = String(row[4] || "").trim() || null;
      const defaultPackage = String(row[5] || "").trim() || null;
      const defaultCutlery = String(row[6] || "").trim() || null;
      const notes = String(row[7] || "").trim() || null;

      try {
        // Check if user already exists by phone
        const existing = await prisma.user.findUnique({ where: { phone } });

        if (existing) {
          // Update only empty fields — don't overwrite existing data
          const updates: Record<string, string | null> = {};
          if (!existing.address && address) updates.address = address;
          if (!existing.chatId && chatId) updates.chatId = chatId;
          if (!existing.defaultPackage && defaultPackage) updates.defaultPackage = defaultPackage;
          if (!existing.defaultCutlery && defaultCutlery) updates.defaultCutlery = defaultCutlery;
          if (!existing.notes && notes) updates.notes = notes;

          if (Object.keys(updates).length > 0) {
            await prisma.user.update({ where: { phone }, data: updates });
            updated++;
          } else {
            skipped++;
          }
        } else {
          // Check if chatId is already taken by another user
          let safeChatId = chatId;
          if (chatId) {
            const chatIdOwner = await prisma.user.findUnique({ where: { chatId } });
            if (chatIdOwner) {
              safeChatId = null; // Don't set chatId if it's already in use
            }
          }

          await prisma.user.create({
            data: {
              phone,
              name,
              address,
              chatId: safeChatId,
              defaultPackage,
              defaultCutlery,
              notes,
            },
          });
          created++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Handle unique constraint violations gracefully
        if (msg.includes("Unique constraint")) {
          skipped++;
        } else {
          errors.push(`Рядок ${i + 1} (${phone}): ${msg}`);
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, created, updated, skipped, errors: [`Помилка читання таблиці: ${msg}`] };
  }

  return { ok: true, created, updated, skipped, errors };
}

// ---------------------------------------------------------------------------
// Import Orders from Google Sheet → PostgreSQL
// ---------------------------------------------------------------------------

/**
 * Reads the "Orders" tab (columns A–O) from the CRM Google Sheet and creates
 * Order records for rows that don't yet exist in the database.
 *
 * Our system writes a UUID into column O for every order it creates. Legacy
 * bot orders have column O empty. We import those and generate a new UUID.
 *
 * Dedup logic:
 *   - If column O has a value AND that ID exists in the DB → skip (our order)
 *   - Otherwise → import as a new order, matching user by phone
 *
 * Sheet columns:
 *   A: Phone
 *   B: Telegram Chat ID
 *   C: CreationDate (e.g. "14.02 (Пн)")
 *   D: WeekStart
 *   E: DeliveryDate (e.g. "14.02 (Пн)")
 *   F: PackageType
 *   G: OrderSummary (dishes)
 *   H: Count
 *   I: Time
 *   J: Status
 *   K: IsPaid (TRUE/FALSE)
 *   L: Cutlery
 *   M: Notes
 *   N: ClientName
 *   O: OrderId (UUID — empty for legacy bot orders)
 */
export async function importOrdersFromSheet(): Promise<ImportResult> {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) return { ok: false, created: 0, updated: 0, skipped: 0, errors: ["Доступ заборонено"] };

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const sheets = createGoogleSheetsClient();

  if (!sheets || !spreadsheetId) {
    return { ok: false, created: 0, updated: 0, skipped: 0, errors: ["Google Sheets не налаштовано"] };
  }

  let created = 0;
  const updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Orders!A:O",
    });

    const rows = resp.data.values || [];
    if (rows.length <= 1) {
      return { ok: true, created: 0, updated: 0, skipped: 0, errors: ["Таблиця Orders порожня"] };
    }

    // Pre-fetch all existing order IDs for fast dedup
    const existingOrders = await prisma.order.findMany({
      select: { id: true },
    });
    const existingIds = new Set(existingOrders.map((o) => o.id));

    // Also build a set of phone+deliveryDate combos already in DB to avoid
    // duplicating legacy orders on repeated imports
    const existingCombos = new Set<string>();
    const allOrders = await prisma.order.findMany({
      select: {
        deliveryDate: true,
        packageType: true,
        user: { select: { phone: true } },
      },
    });
    for (const o of allOrders) {
      const key = `${o.user.phone}|${o.deliveryDate.toISOString().slice(0, 10)}|${o.packageType}`;
      existingCombos.add(key);
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawPhone = String(row[0] || "").replace(/^'/, "").trim(); // Strip leading apostrophe
      const orderId = String(row[14] || "").trim();

      // If column O has a UUID that already exists in our DB → skip
      if (orderId && existingIds.has(orderId)) {
        skipped++;
        continue;
      }

      // Normalize phone
      const phone = normalizePhone(rawPhone);
      if (!/^0\d{9}$/.test(phone)) {
        skipped++;
        if (rawPhone) errors.push(`Рядок ${i + 1}: невалідний телефон "${rawPhone}"`);
        continue;
      }

      // Parse delivery date from column E (format: "DD.MM (День)" or "DD.MM")
      const rawDeliveryDate = String(row[4] || "").trim();
      const deliveryDate = parseCrmDate(rawDeliveryDate);
      if (!deliveryDate) {
        skipped++;
        errors.push(`Рядок ${i + 1}: не вдалось розпізнати дату "${rawDeliveryDate}"`);
        continue;
      }

      const packageType = String(row[5] || "").trim() || "Balance";

      // Check combo dedup (phone + date + package)
      const comboKey = `${phone}|${deliveryDate.toISOString().slice(0, 10)}|${packageType}`;
      if (existingCombos.has(comboKey)) {
        skipped++;
        continue;
      }

      // Find or create user
      let user = await prisma.user.findUnique({ where: { phone } });
      if (!user) {
        const clientName = String(row[13] || "").trim() || phone;
        const chatId = String(row[1] || "").trim() || null;

        // Check chatId uniqueness before creating
        let safeChatId = chatId;
        if (chatId) {
          const chatIdOwner = await prisma.user.findUnique({ where: { chatId } });
          if (chatIdOwner) safeChatId = null;
        }

        user = await prisma.user.create({
          data: { phone, name: clientName, chatId: safeChatId },
        });
      }

      // Parse other fields
      const orderSummary = String(row[6] || "").trim();
      const status = mapLegacyStatus(String(row[9] || "").trim());
      const isPaid = String(row[10] || "").trim().toUpperCase() === "TRUE";
      const cutleryRaw = String(row[11] || "").trim();
      const cutlery = parseInt(cutleryRaw) || 0;
      const notes = String(row[12] || "").trim() || null;

      try {
        await prisma.order.create({
          data: {
            userId: user.id,
            deliveryDate,
            deliveryAddress: user.address,
            packageType,
            items: { days: [], source: "legacy-import", summary: orderSummary },
            status,
            isPaid,
            cutlery,
            notes: notes === "—" ? null : notes,
            paymentMethod: "cash",
          },
        });
        created++;
        existingCombos.add(comboKey); // Prevent same-batch duplicates
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Рядок ${i + 1} (${phone}, ${rawDeliveryDate}): ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, created, updated, skipped, errors: [`Помилка читання таблиці: ${msg}`] };
  }

  return { ok: true, created, updated, skipped, errors };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parses a CRM date string like "14.09 (Сб)" or "14.09" into a Date.
 * Assumes the current year if not specified.
 */
function parseCrmDate(raw: string): Date | null {
  if (!raw) return null;

  // Extract DD.MM from strings like "14.09 (Сб)" or "14.09"
  const match = raw.match(/^(\d{1,2})\.(\d{1,2})/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  // Use current year; if the resulting date is more than 2 months in the
  // future, assume last year (handles Dec→Jan boundary)
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(Date.UTC(year, month - 1, day, 10, 0, 0));

  const twoMonthsFromNow = new Date(now);
  twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);

  if (candidate > twoMonthsFromNow) {
    year--;
  }

  return new Date(Date.UTC(year, month - 1, day, 10, 0, 0));
}

/** Maps legacy Ukrainian status labels to our internal status strings. */
function mapLegacyStatus(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower === "архів" || lower === "архівовано") return "archived";
  if (lower === "скасовано" || lower === "cancelled") return "cancelled";
  if (lower === "доставлено" || lower === "delivered") return "delivered";
  if (lower === "готується" || lower === "preparing") return "preparing";
  if (lower === "в дорозі" || lower === "delivering") return "delivering";
  return "new"; // "Новий" or anything else
}
