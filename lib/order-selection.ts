import { getPackageLimit, PackageType } from "@/lib/order-logic";

export type DaySelections = Record<string, number>;

export type IndivDishQuantity = {
  dishId: string;
  quantity: number;
};

export function isIndivPackage(packageType?: string): packageType is PackageType {
  const normalized = (packageType || "").trim().toLowerCase();
  return (
    normalized === "indiv" ||
    normalized === "індив" ||
    normalized === "индив" ||
    normalized.includes("інд") ||
    normalized.includes("ind")
  );
}

export function buildIndivDishId(category: string, index: number) {
  return `${category}:${index}`;
}

/**
 * True when a day's selection map holds individually-assembled portions
 * (keys shaped like `category:index`) rather than standard one-per-category
 * picks (keys shaped like `category`). This is the ground-truth signal of a
 * day being in "Individual Selection" mode, derived purely from the data that
 * actually exists for THAT day — so it can never leak across days.
 */
export function hasIndivSelections(daySelections: DaySelections): boolean {
  return Object.keys(daySelections).some((key) => key.includes(":"));
}

export function parseIndivDishId(dishId: string) {
  const separatorIndex = dishId.lastIndexOf(":");

  if (separatorIndex <= 0 || separatorIndex === dishId.length - 1) {
    return null;
  }

  const category = dishId.slice(0, separatorIndex);
  const index = Number(dishId.slice(separatorIndex + 1));

  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  return { category, index };
}

export function getDaySelectedCount(daySelections: DaySelections, packageType: PackageType) {
  // A day counts as individual/custom when the package itself is Indiv OR the
  // day's own selection keys are portion-shaped (`category:index`). Both checks
  // are scoped to a single day, so one day's mode never affects another's.
  const isCustomOrIndiv = isIndivPackage(packageType) || hasIndivSelections(daySelections);

  if (isCustomOrIndiv) {
    // Individual mode: validity is the SUM OF PORTION QUANTITIES, never the
    // number of distinct dishes. Selecting 4 portions of a single dish must
    // count as 4 (not 1). Negative/zero entries are ignored defensively.
    return Object.values(daySelections).reduce((sum, q) => sum + (q > 0 ? q : 0), 0);
  }

  // Standard mode: one pick per category — count categories with a valid index.
  return Object.values(daySelections).filter((v) => v !== null && v !== undefined && v >= 0).length;
}

export function isDaySelectionComplete(selectedCount: number, packageType?: string) {
  if (!packageType) {
    return false;
  }

  const { limit, exact } = getPackageLimit(packageType);

  if (exact) {
    return selectedCount === limit;
  }

  // Non-exact (like Indiv) requires at least 1 and up to the limit
  return selectedCount >= 1 && selectedCount <= limit;
}

export function toIndivDishQuantities(daySelections: DaySelections): IndivDishQuantity[] {
  return Object.entries(daySelections)
    .filter(
      ([dishId, quantity]) =>
        (dishId || "").trim().length > 0 && Number.isInteger(quantity) && quantity > 0,
    )
    .map(([dishId, quantity]) => ({
      dishId,
      quantity,
    }))
    .sort((left, right) => left.dishId.localeCompare(right.dishId));
}
