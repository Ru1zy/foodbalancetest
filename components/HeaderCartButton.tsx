"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrderStore } from "@/lib/orderStore";
import { parsePackageType } from "@/lib/package-coerce";
import { getDaySelectedCount, isDaySelectionComplete, isIndivPackage } from "@/lib/order-selection";

export default function HeaderCartButton() {
  const pathname = usePathname();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const unsubHydrate = useOrderStore.persist.onHydrate(() => setHasHydrated(false));
    const unsubFinish = useOrderStore.persist.onFinishHydration(() => setHasHydrated(true));
    setHasHydrated(useOrderStore.persist.hasHydrated());
    return () => {
      unsubHydrate();
      unsubFinish();
    };
  }, []);

  const cartItems = useOrderStore((s) => s.cartItems);
  const selectedPackageRaw = useOrderStore((s) => s.selectedPackage);
  const selectedDates = useOrderStore((s) => s.selectedDates);
  const selections = useOrderStore((s) => s.selections);

  const { totalPackages, totalDays, hasCartContent } = useMemo(() => {
    if (!hasHydrated) {
      return { totalPackages: 0, totalDays: 0, hasCartContent: false };
    }

    const pkg = parsePackageType(selectedPackageRaw);
    let draftDays = 0;

    if (pkg) {
      if (pkg.includes("Sushka")) {
        draftDays = selectedDates.length;
      } else {
        const isIndiv = isIndivPackage(selectedPackageRaw ?? undefined);
        for (const daySelections of Object.values(selections)) {
          const count = getDaySelectedCount(daySelections, pkg);
          if (isIndiv ? count >= 1 : isDaySelectionComplete(count, pkg)) {
            draftDays += 1;
          }
        }
      }
    }

    const addedCartDays = cartItems.reduce((sum, item) => sum + item.dayCount * item.quantity, 0);
    const addedCartPackages = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    const totalDaysCount = addedCartDays + draftDays;
    const totalPackagesCount = addedCartPackages + (draftDays > 0 ? 1 : 0);

    return {
      totalPackages: totalPackagesCount,
      totalDays: totalDaysCount,
      hasCartContent: totalDaysCount > 0 || totalPackagesCount > 0,
    };
  }, [hasHydrated, cartItems, selectedPackageRaw, selectedDates, selections]);

  if (!hasHydrated || !hasCartContent) {
    return null;
  }

  const isCheckoutPage = pathname === "/checkout";

  return (
    <Link
      href="/checkout"
      className={`group relative flex items-center gap-1.5 sm:gap-2.5 rounded-2xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-all duration-300 active:scale-95 shadow-sm ${
        isCheckoutPage
          ? "bg-emerald-600 text-white shadow-emerald-500/25"
          : "bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/30 dark:border-emerald-400/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20 hover:border-emerald-500/50 backdrop-blur-md"
      }`}
      title="Перейти до кошика та оплати"
    >
      <span className="text-base sm:text-lg leading-none transition-transform duration-300 group-hover:scale-115">
        🛒
      </span>
      <span className="hidden xs:inline font-black">Кошик</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-black tracking-tight ${
          isCheckoutPage
            ? "bg-emerald-700 text-white"
            : "bg-emerald-600 text-white shadow-xs"
        }`}
      >
        {totalDays > 0 ? `${totalDays} дн.` : `${totalPackages} рац.`}
      </span>
    </Link>
  );
}
