"use client";

import { useEffect, useState, useRef } from "react";
import { useOrderStore } from "@/lib/orderStore";
import { getMenuItems, getTariffs } from "@/app/actions/menu-impl";
import { getPromoMaterialsAction } from "@/app/actions/tariff-impl";
import OrderWizard from "./OrderWizard";
import LandingReviewsSection from "@/components/LandingReviewsSection";
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

type PromoItem = {
  key: string;
  url: string;
};

type PublicReview = {
  id: string;
  userName: string;
  userAvatar: string | null;
  rating: number;
  comment: string;
  photoUrl: string | null;
  adminReply: string | null;
  adminReplyAt: Date | null;
  createdAt: Date;
};

type Props = {
  orderingMode?: "AUTO" | "FORCE_OPEN" | "FORCE_CLOSED";
  orderingCustomMessage?: string;
  initialTariffs?: Tariff[];
  initialPromoMaterials?: PromoItem[];
  initialMenuItems?: MenuItem[];
  initialReviews?: PublicReview[];
  initialReviewsSummary?: { totalCount: number; avgRating: number };
};

export default function OrderStoreWrapper({
  orderingMode = "AUTO",
  orderingCustomMessage = "",
  initialTariffs = [],
  initialPromoMaterials = [],
  initialMenuItems = [],
  initialReviews = [],
  initialReviewsSummary = { totalCount: 0, avgRating: 5.0 },
}: Props) {
  const selectedPackage = useOrderStore((s) => s.selectedPackage);
  const step = useOrderStore((s) => s.step);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const [tariffs, setTariffs] = useState<Tariff[]>(initialTariffs);
  const [promoMaterials, setPromoMaterials] = useState<PromoItem[]>(initialPromoMaterials);
  const [loading, setLoading] = useState(initialTariffs.length === 0);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (initialTariffs.length > 0 && !selectedPackage) {
        return;
      }
    }

    async function fetchData() {
      if (tariffs.length === 0) {
        setLoading(true);
        const [items, tariffData, promoData] = await Promise.all([
          getMenuItems(selectedPackage),
          getTariffs(),
          getPromoMaterialsAction(),
        ]);
        setMenuItems(items);
        setTariffs(tariffData as Tariff[]);
        setPromoMaterials(promoData);
        setLoading(false);
      } else {
        const items = await getMenuItems(selectedPackage);
        setMenuItems(items);
      }
    }
    fetchData();
  }, [selectedPackage]);

  if (loading) {
    return (
      <div className="flex min-h-[600px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 dark:border-emerald-400 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <main className="flex-grow flex flex-col">
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:px-8 lg:px-16">
        {menuItems.length === 0 && tariffs.length === 0 ? (
          <div className="rounded-xl p-16 text-center border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="mb-6 flex justify-center">
              <img src="/foodbalancelogo.png" alt="Food Balance" className="h-32 w-32 object-contain drop-shadow-md" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-4">
              Меню оновлюється
            </h2>
            <p className="text-lg text-gray-500 dark:text-slate-400">Незабаром з’являться нові смачні страви</p>
          </div>
        ) : (
          <OrderWizard
            menuItems={menuItems}
            tariffs={tariffs}
            promoMaterials={promoMaterials}
            orderingMode={orderingMode}
            orderingCustomMessage={orderingCustomMessage}
          />
        )}
      </section>
      {step === 1 && (
        <LandingReviewsSection
          initialReviews={initialReviews}
          initialSummary={initialReviewsSummary}
        />
      )}
    </main>
  );
}
