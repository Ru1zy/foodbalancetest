/**
 * Shared validation helpers for the `SheetConfig` model so that the same rules
 * are enforced both in the client form (instant UX feedback) and in the server
 * actions (authoritative guard). Keep this file framework-agnostic — it is
 * imported from both a "use client" component and a "use server" module.
 */

/** `MM.YYYY` — month 01-12, then a dot, then a 4-digit year (e.g. `03.2026`). */
export const MONTH_KEY_REGEX = /^(0[1-9]|1[0-2])\.\d{4}$/;

/** True when `value` is a syntactically valid `MM.YYYY` month key. */
export function isValidMonthKey(value: string): boolean {
  return MONTH_KEY_REGEX.test(value.trim());
}

/**
 * Accepts either a raw Google spreadsheet ID or a full sheet URL and returns
 * the bare ID. If no `/d/<id>/` segment is found, the trimmed input is returned
 * unchanged so a plain ID still works.
 */
export function normalizeSpreadsheetId(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

export type SheetConfigInput = {
  monthKey: string;
  spreadsheetId: string;
  label?: string;
};

export type ValidationResult =
  | { ok: true; value: { monthKey: string; spreadsheetId: string; label: string | null } }
  | { ok: false; error: string };

/**
 * Validates and normalizes a `SheetConfig` payload. Used by the server actions
 * as the single source of truth before any database write.
 */
export function validateSheetConfigInput(input: SheetConfigInput): ValidationResult {
  const monthKey = input.monthKey?.trim() ?? "";
  const spreadsheetId = normalizeSpreadsheetId(input.spreadsheetId ?? "");
  const label = input.label?.trim() ? input.label.trim() : null;

  if (!isValidMonthKey(monthKey)) {
    return { ok: false, error: "Невірний формат місяця. Очікується MM.YYYY (напр. 03.2026)." };
  }

  if (!spreadsheetId) {
    return { ok: false, error: "ID таблиці не може бути порожнім." };
  }

  return { ok: true, value: { monthKey, spreadsheetId, label } };
}
