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
      const chatId = String(row[4] || "").trim() || null;

      // Skip rows without chatId — importing phone-only records creates
      // orphan accounts that block real Telegram registrations (phone
      // unique constraint). Let them register fresh on the site instead.
      if (!chatId) {
        skipped++;
        continue;
      }

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
          const chatIdOwner = await prisma.user.findUnique({ where: { chatId } });
          if (chatIdOwner) {
            skipped++;
            continue;
          }

          await prisma.user.create({
            data: {
              phone,
              name,
              address,
              chatId,
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

