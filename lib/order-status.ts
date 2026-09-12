export const ORDER_STATUS_OPTIONS = [
  { label: "Нове", value: "new" },
  { label: "Оплачено", value: "paid" },
  { label: "Готується", value: "cooking" },
  { label: "Доставлено", value: "delivered" },
  { label: "Архів", value: "archived" },
  { label: "Скасовано", value: "cancelled" },
] as const;

export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number]["value"];

export function isOrderStatus(status: string): status is OrderStatus {
  return ORDER_STATUS_OPTIONS.some((option) => option.value === status);
}

export function getOrderStatusLabel(status: string) {
  if (status === "archived") return "📦 Архів";
  if (status === "cancelled" || status === "Скасовано") return "❌ Скасовано";
  if (status === "Передано в учёт") return "📊 В обліку";
  if (status === "Оплачено") return "✓ Оплачено";
  if (status === "Доставлено") return "✓ Доставлено";
  return ORDER_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function getOrderStatusClasses(status: string) {
  switch (status) {
    case "paid":
    case "Оплачено":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "cooking":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    case "delivered":
    case "Доставлено":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300";
    case "archived":
      return "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400";
    case "cancelled":
    case "Скасовано":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
    case "new":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

