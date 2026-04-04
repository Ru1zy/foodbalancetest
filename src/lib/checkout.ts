export const MAX_CUTLERY_COUNT = 4;
const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;

export const DELIVERY_METHOD_LABELS = {
  delivery: "Доставка",
  pickup: "Самовивіз",
} as const;

export type DeliveryMethod = keyof typeof DELIVERY_METHOD_LABELS;

export type CheckoutFormValues = {
  address: string;
  comment: string;
  cutlery: number;
  deliveryDate: string;
  deliveryMethod: DeliveryMethod;
  name: string;
  phone: string;
};

export type CheckoutFieldErrors = Partial<Record<"address" | "cart" | "name" | "phone", string>>;

export function isDeliveryMethod(value: string): value is DeliveryMethod {
  return value === "delivery" || value === "pickup";
}

export function getDeliveryMethodLabel(method: DeliveryMethod) {
  return DELIVERY_METHOD_LABELS[method];
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
  const trimmed = rawPhone.trim();
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

export function getMinDeliveryDate(): string {
  // Find next Monday
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 1 ? 0 : (dayOfWeek === 0 ? 1 : 8 - dayOfWeek);
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  
  // Format as YYYY-MM-DD
  const year = nextMonday.getFullYear();
  const month = String(nextMonday.getMonth() + 1).padStart(2, '0');
  const day = String(nextMonday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseCheckoutFormData(formData: FormData): CheckoutFormValues {
  const rawDeliveryMethod = String(formData.get("deliveryMethod") || "delivery").trim();
  const rawDeliveryDate = String(formData.get("deliveryDate") || "").trim();

  return {
    address: String(formData.get("address") || "").trim(),
    comment: String(formData.get("comment") || "").trim(),
    cutlery: parseCutleryCount(formData.get("cutlery")),
    deliveryDate: rawDeliveryDate || getMinDeliveryDate(),
    deliveryMethod: isDeliveryMethod(rawDeliveryMethod) ? rawDeliveryMethod : "delivery",
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

  if (values.deliveryMethod === "delivery" && !values.address) {
    errors.address = "Вкажіть адресу доставки.";
  }

  return errors;
}
