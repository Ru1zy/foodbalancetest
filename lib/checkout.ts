export const MAX_CUTLERY_COUNT = 4;
const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;

export function clampCutleryCount(value: number) {
  return Math.min(MAX_CUTLERY_COUNT, Math.max(0, value));
}

export function parseCutleryCount(value: FormDataEntryValue | number | null | undefined) {
  const parsedValue =
    typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);

  if (!Number.isInteger(parsedValue)) {
    return 0;
  }

  return clampCutleryCount(parsedValue);
}

export function normalizePhone(rawPhone: string) {
  const trimmed = (rawPhone || "").trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function hasValidPhoneNumber(phone: string) {
  const digitsCount = phone.replace(/\D/g, "").length;
  return digitsCount >= MIN_PHONE_DIGITS && digitsCount <= MAX_PHONE_DIGITS;
}

export function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** e.g. "Вівторок (07.04)" for menu-week delivery slots. */
export function formatScheduleDayLabel(date: Date): string {
  const weekdayRaw = new Intl.DateTimeFormat("uk-UA", { weekday: "long" }).format(date);
  const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
  const dayMonth = new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  return `${weekday} (${dayMonth})`;
}

/** YYYY-MM-DD in Europe/Kyiv — for comparing client vs server delivery dates. */
export function kyivCalendarDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
