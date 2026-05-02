"use client";

import { useState } from "react";
import { 
  calculateSubscriptionPrice, 
  getDiscountForPackage, 
  type PackageDuration 
} from "@/lib/subscription-logic";

type Pkg = {
  id: string;
  name: string;
  basePrice: number;
};

type Props = {
  pkg: Pkg;
};

export default function SubscriptionOptions({ pkg }: Props) {
  const [loading, setLoading] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSushka = pkg.id.toLowerCase().includes("sushka") || pkg.name.toLowerCase().includes("sushka");
  const durations: PackageDuration[] = isSushka ? [2, 7, 14] : [2, 7, 14, 30];

  const handlePurchase = async (duration: PackageDuration) => {
    setLoading(duration);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/balance/topup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packageId: pkg.name, // Using pkg.name as it's the identifier in UserBalance as per task 1 schema
          duration: duration,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Помилка при поповненні балансу");
      }

      setSuccess(`Успішно! Додано ${duration} днів до вашого балансу.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сталася помилка");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-8">
      <h3 className="mb-6 text-xl font-bold text-gray-900">Оберіть абонемент ({pkg.name})</h3>
      
      {success && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {durations.map((duration) => {
          const { totalOriginal, totalDiscounted, pricePerDay } = calculateSubscriptionPrice(
            pkg.basePrice,
            pkg.id,
            duration
          );
          const discountPercent = Math.round(getDiscountForPackage(pkg.id, duration) * 100);

          return (
            <div
              key={duration}
              className="relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              {discountPercent > 0 && (
                <div className="absolute -right-2 -top-2 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                  -{discountPercent}%
                </div>
              )}
              
              <div className="mb-1 text-lg font-bold text-gray-900">{duration} днів</div>
              
              <div className="mb-4">
                <span className="font-bold text-red-600">{totalDiscounted} грн</span>
                {" "}замість{" "}
                <s className="text-gray-500">{totalOriginal} грн</s>
              </div>

              <div className="mb-6 text-sm font-semibold text-gray-600">
                ({pricePerDay} грн/день)
              </div>

              <button
                type="button"
                disabled={loading !== null}
                onClick={() => handlePurchase(duration)}
                className="mt-auto w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                {loading === duration ? "Обробка..." : "Придбати абонемент"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
