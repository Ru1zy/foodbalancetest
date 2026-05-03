import { getPackageLimit, PackageType } from "@/lib/order-logic";

export type DaySelections = Record<string, number>;

export type IndivDishQuantity = {
  dishId: string;
  quantity: number;
};

export function isIndivPackage(packageType?: string): packageType is PackageType {
  const normalized = packageType?.trim().toLowerCase();
  return normalized === "indiv" || normalized === "індив" || normalized === "индив";
}

export function buildIndivDishId(category: string, index: number) {
  return `${category}:${index}`;
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

export function getIndivDaySelectedCount(daySelections: DaySelections) {
  return Object.values(daySelections).reduce((sum, quantity) => {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return sum;
    }

    return sum + quantity;
  }, 0);
}

export function getDaySelectedCount(daySelections: DaySelections, packageType: PackageType) {
  return isIndivPackage(packageType) ? getIndivDaySelectedCount(daySelections) : Object.keys(daySelections).length;
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
