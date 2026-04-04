export const ORDER_STATUS_OPTIONS = [
  { label: "Нове", value: "new" },
  { label: "Оплачено", value: "paid" },
  { label: "Готується", value: "cooking" },
  { label: "Доставлено", value: "delivered" },
] as const;

export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number]["value"];

export function isOrderStatus(status: string): status is OrderStatus {
  return ORDER_STATUS_OPTIONS.some((option) => option.value === status);
}

export function getOrderStatusLabel(status: string) {
  return ORDER_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function getOrderStatusClasses(status: string) {
  switch (status) {
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "cooking":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "delivered":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "new":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}
