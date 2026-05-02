export type PackageDuration = 2 | 7 | 14 | 30;

export function getDiscountForPackage(packageId: string, days: PackageDuration): number {
  const isSushka = packageId.toLowerCase().includes('sushka');

  if (isSushka) {
    if (days === 2) return 0.10; // 10% for Sushka 2-day trial
    if (days === 7) return 0.05; // 5%
    if (days === 14) return 0.10; // 10%
    return 0; // 30 days not allowed for Sushka
  } else {
    if (days === 2) return 0.15; // 15% for standard 2-day trial
    if (days === 7) return 0.05; // 5%
    if (days === 14) return 0.10; // 10%
    if (days === 30) return 0.15; // 15%
    return 0;
  }
}

export function calculateSubscriptionPrice(basePrice: number, packageId: string, days: PackageDuration): {
  totalOriginal: number;
  totalDiscounted: number;
  pricePerDay: number;
} {
  const discountPercent = getDiscountForPackage(packageId, days);
  const totalOriginal = basePrice * days;
  const totalDiscounted = Math.round(totalOriginal * (1 - discountPercent));
  const pricePerDay = Math.round(totalDiscounted / days);

  return { totalOriginal, totalDiscounted, pricePerDay };
}
