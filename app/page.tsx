import OrderStoreWrapper from "./OrderStoreWrapper";
import { getPublicSettings } from "./actions/settings";
import { getTariffs, getMenuItems } from "./actions/menu-impl";
import { getPromoMaterialsAction } from "./actions/tariff-impl";
import { getPublicReviewsAction } from "./actions/feedback";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [publicSettings, tariffs, promoMaterials, menuItems, reviewsData] =
    await Promise.all([
      getPublicSettings(),
      getTariffs(),
      getPromoMaterialsAction(),
      getMenuItems(null),
      getPublicReviewsAction(),
    ]);

  return (
    <OrderStoreWrapper
      orderingMode={publicSettings.orderingMode}
      orderingCustomMessage={publicSettings.orderingCustomMessage}
      initialTariffs={tariffs}
      initialPromoMaterials={promoMaterials}
      initialMenuItems={menuItems}
      initialReviews={reviewsData?.reviews || []}
      initialReviewsSummary={
        reviewsData?.summary || { totalCount: 0, avgRating: 5.0 }
      }
    />
  );
}
