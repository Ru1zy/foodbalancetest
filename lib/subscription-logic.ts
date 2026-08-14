export type PackageDuration = number;

export function getDiscountForPackage(packageId: string, days: number): number {
  const isSushka = packageId.toLowerCase().includes('sushka');

  if (isSushka) {
    if (days === 2) return 0.10; // 10% for Sushka 2-day trial
    if (days >= 14) return 0.10; // 10%
    if (days >= 7) return 0.05; // 5%
    return 0; 
  } else {
    if (days === 2) return 0.15; // 15% for standard 2-day trial
    if (days >= 30) return 0.15; // 15%
    if (days >= 14) return 0.10; // 10%
    if (days >= 7) return 0.05; // 5%
    return 0;
  }
}

export function calculateSubscriptionPrice(basePrice: number, packageId: string, days: number): {
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

