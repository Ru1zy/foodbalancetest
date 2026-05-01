export const MAX_CUTLERY_COUNT = 4;
const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;
const DELIVERY_SLOT_DURATION_MINUTES = 30;
const DELIVERY_SLOT_STEP_MINUTES = 10;
const DELIVERY_WINDOW_START_MINUTES = 17 * 60;
const DELIVERY_WINDOW_END_MINUTES = 22 * 60;

export type CheckoutFormValues = {
  address: string;
  comment: string;
  cutlery: number;
  deliveryTime: string;
  name: string;
  phone: string;
};

export type CheckoutFieldErrors = Partial<Record<"address" | "cart" | "name" | "phone", string>>;

function formatMinutesAsTime(totalMinutes: number) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function buildDeliveryTimeOptions() {
  const options: string[] = [];

  for (
    let startMinutes = DELIVERY_WINDOW_START_MINUTES;
    startMinutes + DELIVERY_SLOT_DURATION_MINUTES <= DELIVERY_WINDOW_END_MINUTES;
    startMinutes += DELIVERY_SLOT_STEP_MINUTES
  ) {
    const endMinutes = startMinutes + DELIVERY_SLOT_DURATION_MINUTES;
    options.push(`${formatMinutesAsTime(startMinutes)} - ${formatMinutesAsTime(endMinutes)}`);
  }

  return options;
}

export const DELIVERY_TIME_OPTIONS = buildDeliveryTimeOptions();

export function normalizeDeliveryTime(value: string) {
  const normalizedValue = (value || "").trim();
  return DELIVERY_TIME_OPTIONS.includes(normalizedValue) ? normalizedValue : "";
}

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
    deliveryTime: normalizeDeliveryTime(String(formData.get("deliveryTime") || "")),
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
