import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import TodayPageClient from "./TodayPageClient";

async function getTodayOrders(dateStr: string) {
  try {
    // Parse date in DD.MM format
    const [day, month] = dateStr.split(".");
    const currentYear = new Date().getFullYear();
    const targetDate = new Date(
      currentYear,
      parseInt(month) - 1,
      parseInt(day)
    );
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: targetDate,
          lt: nextDay,
        },
        status: { not: "cancelled" },
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return orders;
  } catch (error) {
    console.error("Error fetching today orders:", error);
    return [];
  }
}

export default async function TodayPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/");
  }

  // Default to today in DD.MM format
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const defaultDate = `${day}.${month}`;

  const orders = await getTodayOrders(defaultDate);

  return <TodayPageClient initialOrders={orders} initialDate={defaultDate} />;
}
