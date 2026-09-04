import OrderStoreWrapper from "./OrderStoreWrapper";
import { getPublicSettings } from "./actions/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const publicSettings = await getPublicSettings();
  return (
    <OrderStoreWrapper
      orderingMode={publicSettings.orderingMode}
      orderingCustomMessage={publicSettings.orderingCustomMessage}
    />
  );
}
