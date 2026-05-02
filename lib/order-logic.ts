export type PackageType = "Slim" | "Balance" | "Active" | "Sport" | "Sushka" | "Sushka XS" | "Sushka S" | "Indiv" | "Template";

/** Базова ціна одного дня (грн) для розрахунку замовлення. */
export const PACKAGE_PRICES: Record<PackageType, number> = {
  Slim: 610,
  Balance: 700,
  Active: 800,
  Sport: 900,
  Sushka: 0,
  "Sushka XS": 500,
  "Sushka S": 600,
  Indiv: 700,
  Template: 0,
};

export function getOrderTotalUah(packageType: PackageType, totalDays: number): number {
  if (totalDays < 1) {
    return 0;
  }
  const unit = PACKAGE_PRICES[packageType] ?? 0;
  return totalDays * unit;
}

export function getPackageLimit(packageName?: string): number {
  if (!packageName) return 4;
  const p = String(packageName).trim().toLowerCase();
  if (p.includes("слім") || p.includes("slim") || p.includes("слим")) return 3;
  if (p.includes("sport")) return 5;
  if (p.includes("інд") || p.includes("ind")) return 10;
  if (p.includes("sushka xs")) return 3;
  if (p.includes("sushka s")) return 4;
  return 4;
}

export function mealSuffix(packageName?: string, mealType?: string): string {
  if (!packageName || !mealType) return "";
  const p = String(packageName).trim().toLowerCase();
  const isActiveOrSport = p.includes("active") || p.includes("sport");

  if (isActiveOrSport && (mealType === "lunch" || mealType === "dinner")) {
    return " (1,5)";
  }
  return "";
}

const KYIV_TIMEZONE = "Europe/Kyiv";

function getKyivParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KYIV_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "long",
    hour12: false,
  }).formatToParts(d);

  const result: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  }

  const weekdayMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  return {
    year: Number(result.year),
    month: Number(result.month),
    day: Number(result.day),
    hour: Number(result.hour),
    minute: Number(result.minute),
    second: Number(result.second),
    weekday: weekdayMap[result.weekday],
  };
}

function constructUTCFromKyiv(parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number; }) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0, 0));
}

// TODO: REMOVE FOR PRODUCTION
// Temporary bypass for testing - allows ordering any time
export const NEXT_WEEK_OPEN = true;

// Original time-based logic (commented out for testing):
// export const NEXT_WEEK_OPEN = (() => {
//   const nowKyiv = getKyivParts(new Date());
//   const isSaturdayAfterNoon = nowKyiv.weekday === 6 && nowKyiv.hour >= 12;
//   const isSunday = nowKyiv.weekday === 0;
//   return isSaturdayAfterNoon || isSunday;
// })();

function getKyivMidnight(parts: { year: number; month: number; day: number; }) {
  return constructUTCFromKyiv({ year: parts.year, month: parts.month, day: parts.day, hour: 0, minute: 0, second: 0 });
}

function getTargetMonday(nowKyivParts: ReturnType<typeof getKyivParts>) {
  const currentDayOffset = nowKyivParts.weekday === 0 ? -6 : 1 - nowKyivParts.weekday;
  const baseMonday = new Date(getKyivMidnight(nowKyivParts).getTime() + currentDayOffset * 24 * 60 * 60 * 1000);
  if (NEXT_WEEK_OPEN) {
    return new Date(baseMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return baseMonday;
}

function getTargetDate(dayOfWeek: number, targetMonday: Date) {
  if (dayOfWeek < 1 || dayOfWeek > 7) throw new Error("dayOfWeek must be 1..7");
  return new Date(targetMonday.getTime() + (dayOfWeek - 1) * 24 * 60 * 60 * 1000);
}

/** Monday that starts the menu week (same rule as day selectability). */
export function getMenuWeekMonday(reference: Date = new Date()): Date {
  return getTargetMonday(getKyivParts(reference));
}

/** Calendar date for a menu day index 1–7 within the current menu week. */
export function dateForMenuDayOfWeek(dayOfWeek: number, reference: Date = new Date()): Date {
  return getTargetDate(dayOfWeek, getMenuWeekMonday(reference));
}

/** Earliest delivery day among the given weekday indices. */
export function earliestDeliveryDateFromDayOfWeeks(
  dayOfWeeks: number[],
  reference: Date = new Date(),
): Date | null {
  const valid = dayOfWeeks.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (valid.length === 0) {
    return null;
  }
  const minDay = Math.min(...valid);
  return dateForMenuDayOfWeek(minDay, reference);
}

/**
 * Earliest menu delivery date for cart days keyed by Menu.id, using a map from menu row id → dayOfWeek (1–7).
 */
export function earliestMenuDeliveryDateFromCartDays(
  days: Array<{ dayId: string }>,
  menuDayByItemId: Record<string, number>,
  reference: Date = new Date(),
): Date | null {
  const weeks = days.map((d) => menuDayByItemId[d.dayId]);
  if (weeks.length === 0 || weeks.some((n) => !Number.isInteger(n) || n < 1 || n > 7)) {
    return null;
  }
  return earliestDeliveryDateFromDayOfWeeks(weeks, reference);
}

export function getDeadlineForDay(target: Date): Date {
  const targetKyiv = getKyivParts(target);
  let deadlineDay = targetKyiv.day;
  let deadlineHour = 14;

  if (targetKyiv.weekday === 1) {
    deadlineDay = targetKyiv.day - 2;
    deadlineHour = 23;
  } else if (targetKyiv.weekday === 6) {
    deadlineDay = targetKyiv.day - 2;
    deadlineHour = 14;
  } else if (targetKyiv.weekday === 0) {
    deadlineDay = targetKyiv.day - 3;
    deadlineHour = 14;
  } else {
    deadlineDay = targetKyiv.day - 2;
    deadlineHour = 14;
  }

  const deadlineKyiv = constructUTCFromKyiv({
    year: targetKyiv.year,
    month: targetKyiv.month,
    day: deadlineDay,
    hour: deadlineHour,
    minute: 0,
    second: 0,
  });

  return deadlineKyiv;
}

export function isDaySelectable(dayOfWeek: number): boolean {
  // TODO: REMOVE FOR PRODUCTION
  // Temporary bypass for testing - all days are selectable
  return true;

  // Original time-based validation logic (commented out for testing):
  // if (!dayOfWeek || dayOfWeek < 1 || dayOfWeek > 7) return false;
  //
  // const nowKyivParts = getKyivParts(new Date());
  // const nowKyiv = constructUTCFromKyiv(nowKyivParts);
  //
  // const targetMonday = getTargetMonday(nowKyivParts);
  // const targetDate = getTargetDate(dayOfWeek, targetMonday);
  //
  // const deadline = getDeadlineForDay(targetDate);
  // return nowKyiv.getTime() < deadline.getTime();
}

/** Weekday indices 1–7 still open for the current menu week (same rules as `isDaySelectable`). */
export function getSelectableDays(): number[] {
  return [1, 2, 3, 4, 5, 6, 7].filter((d) => isDaySelectable(d));
}
