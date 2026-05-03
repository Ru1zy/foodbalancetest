export const MAX_CUTLERY_COUNT = 4;
const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;

export type CheckoutFormValues = {
  address: string;
  comment: string;
  cutlery: number;
  name: string;
  phone: string;
};

export type CheckoutFieldErrors = Partial<Record<"address" | "cart" | "name" | "phone", string>>;

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

export function parseCheckoutFormData(formData: FormData): CheckoutFormValues {
  return {
    address: String(formData.get("address") || "").trim(),
    comment: String(formData.get("comment") || "").trim(),
    cutlery: parseCutleryCount(formData.get("cutlery")),
    name: String(formData.get("name") || "").trim(),
    phone: normalizePhone(String(formData.get("phone") || "")),
  };
}

export function validateCheckoutFormValues(values: CheckoutFormValues): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};

  if (!values.name) {
    errors.name = "Вкажіть ім'я.";
  }

  if (!hasValidPhoneNumber(values.phone)) {
    errors.phone = "Вкажіть коректний номер телефону.";
  }

  if (!values.address) {
    errors.address = "Вкажіть адресу доставки.";
  }

  return errors;
}
