"use client";

import { useEffect, useState } from "react";
import { useOrderStore } from "@/lib/orderStore";
import { getMenuItems, getTariffs } from "@/app/actions/menu-impl";
import OrderWizard from "./OrderWizard";
import { MenuItem } from "@/lib/menu-types";

type Tariff = {
  id: string;
  name: string;
  title: string;
  kcal: string;
  price: string;
  basePrice: number;
  previewImageUrl: string | null;
  imageUrl: string | null;
};

export default function OrderStoreWrapper() {
  const selectedPackage = useOrderStore((s) => s.selectedPackage);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [items, tariffData] = await Promise.all([
        getMenuItems(selectedPackage),
        getTariffs(),
      ]);
      setMenuItems(items);
      setTariffs(tariffData as Tariff[]);
      setLoading(false);
    }
    fetchData();
  }, [selectedPackage]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <main className="flex-grow flex flex-col">
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:px-8 lg:px-16">
        {menuItems.length === 0 ? (
          <div className="rounded-3xl p-16 text-center border border-gray-200 bg-white">
            <div className="mb-6 flex justify-center">
              <img src="/foodbalancelogo.png" alt="Food Balance" className="h-32 w-32 object-contain border border-gray-200" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Меню оновлюється
            </h2>
            <p className="text-lg text-gray-500">Незабаром з’являться нові смачні страви</p>
          </div>
        ) : (
          <OrderWizard menuItems={menuItems} tariffs={tariffs} />
        )}
      </section>
    </main>
  );
}
