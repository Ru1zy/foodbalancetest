import type { DishOption, MenuItem } from "@/lib/menu-types";
import { mealSuffix, type PackageType } from "@/lib/order-logic";

const normalizeDish = (dish: DishOption, suffix = "") => ({
  full: suffix ? `${dish.full}${suffix}` : dish.full,
  short: suffix ? `${dish.short}${suffix}` : dish.short,
});

export function transformMenuForPackage(item: MenuItem, packageType: PackageType): MenuItem {
  if (packageType === "Sushka") {
    return item;
  }

  if (item.packageType !== "Template") {
    return item;
  }

  const lunchSuffix = mealSuffix(packageType, "lunch");
  const dinnerSuffix = mealSuffix(packageType, "dinner");

  const breakfast = (item.dishes.breakfast || []).map((dish) => normalizeDish(dish, ""));
  const lunch = (item.dishes.lunch || []).map((dish) => normalizeDish(dish, lunchSuffix));
  const dinner = (item.dishes.dinner || []).map((dish) => normalizeDish(dish, dinnerSuffix));
  const snack = packageType === "Slim" ? [] : (item.dishes.snack || []).map((dish) => normalizeDish(dish, ""));
  const extra = packageType === "Sport" ? [...breakfast, ...lunch, ...dinner, ...snack] : undefined;

  return {
    ...item,
    dishes: { breakfast, lunch, dinner, snack, extra },
  };
}

export function getMenuRowsForPackage(menuItems: MenuItem[], selectedPackage: PackageType): MenuItem[] {
  const templates = menuItems.filter((item) => item.packageType === "Template");
  const sushka = menuItems.filter((item) => item.packageType === "Sushka");

  const source = selectedPackage.includes("Sushka") ? sushka : templates;
  return source
    .map((item) => transformMenuForPackage(item, selectedPackage))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

export function getMenuRowIdsForPackageDay(
  menuItems: MenuItem[],
  selectedPackage: PackageType,
  dayOfWeek: number,
): string[] {
  return getMenuRowsForPackage(menuItems, selectedPackage)
    .filter((item) => item.dayOfWeek === dayOfWeek)
    .map((item) => item.id);
}
