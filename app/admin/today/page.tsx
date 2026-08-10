import { notFound } from "next/navigation";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { findDeliveryOrdersForRange } from "@/lib/delivery-orders";
import { kyivDayRangeUtc, kyivTodayParts } from "@/lib/order-logic";
import TodayPageClient from "./TodayPageClient";

async function getTodayOrders(dateStr: string) {
  try {
    // Parse date in DD.MM format
    const [day, month] = dateStr.split(".");
    const { year } = kyivTodayParts();
    const { start: targetDate, end: nextDay } = kyivDayRangeUtc(
      year,
      parseInt(month, 10),
      parseInt(day, 10),
    );

    return await findDeliveryOrdersForRange(targetDate, nextDay);
  } catch (error) {
    console.error("Error fetching today orders:", error);
    return [];
  }
}

export default async function TodayPage() {
  // Layout guards are not a data-access boundary: Next.js may render child
  // segments in parallel. Re-check admin authorization before reading orders.
  const adminUser = await getAuthenticatedAdminUser();
  if (!adminUser) {
    notFound();
  }

  // Default to today in DD.MM format
  const today = kyivTodayParts();
  const day = String(today.day).padStart(2, "0");
  const month = String(today.month).padStart(2, "0");
  const defaultDate = `${day}.${month}`;

  const orders = await getTodayOrders(defaultDate);

  return <TodayPageClient initialOrders={orders} initialDate={defaultDate} />;
}
