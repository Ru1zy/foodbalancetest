"use client";

import { useState, useEffect } from "react";
import { useOrderStore } from "@/lib/orderStore";
import { parsePackageType } from "@/lib/package-coerce";
import { getDaySelectedCount } from "@/lib/order-selection";
import { getPackageLimit } from "@/lib/order-logic";

type Props = {
  onOpenCart: () => void;
};

export default function FloatingCart({ onOpenCart }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const [prevCount, setPrevCount] = useState(0);
  const [isPulse, setIsPulse] = useState(false);

  const selectedPackageRaw = useOrderStore((state) => state.selectedPackage);
  const selections = useOrderStore((state) => state.selections);
  const pkg = parsePackageType(selectedPackageRaw);
  const packageLimit = getPackageLimit(pkg ?? undefined);

  const completedDaysCount = Object.values(selections).filter((daySelections) => {
    if (!pkg) return false;
    const selectedCount = getDaySelectedCount(daySelections, pkg);
    return selectedCount === packageLimit;
  }).length;

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 200);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (completedDaysCount > prevCount) {
      setIsPulse(true);
      setTimeout(() => setIsPulse(false), 600);
    }
    setPrevCount(completedDaysCount);
  }, [completedDaysCount, prevCount]);

  if (!pkg) return null;

  return (
    <button
      onClick={onOpenCart}
      className={`fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-blue-500/50 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
      } ${isPulse ? "animate-pulse" : ""}`}
    >
      <svg
        className="h-7 w-7"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>

      {completedDaysCount > 0 && (
        <div className={`absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-lg transition-transform ${
          isPulse ? "scale-125" : "scale-100"
        }`}>
          {completedDaysCount}
        </div>
      )}

      {/* Glow effect */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 opacity-0 blur-xl transition-opacity group-hover:opacity-75" />
    </button>
  );
}
