import type { PackageType } from "@/lib/order-logic";

const PACKAGE_VALUES: readonly string[] = [
  "Slim",
  "Balance",
  "Active",
  "Sport",
  "Sushka",
  "Sushka XS",
  "Sushka S",
  "Indiv",
  "Template",
];

/** Valid tariff id from the store (`string | null`) → typed package for menu/cart logic. */
export function parsePackageType(value: string | null | undefined): PackageType | null {
  if (value == null || value === "") {
    return null;
  }
  return PACKAGE_VALUES.includes(value) ? (value as PackageType) : null;
}
