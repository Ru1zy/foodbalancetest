import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import TodayPageClient from "./TodayPageClient";

async function getTodayOrders(dateStr: string) {
  try {
    // Parse date in DD.MM.YYYY format
    const [day, month, year] = dateStr.split(".");
    const targetDate = new Date(
      parseInt(year),
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
        isPaid: true,
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

  // Default to today in DD.MM.YYYY format
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  const defaultDate = `${day}.${month}.${year}`;

  const orders = await getTodayOrders(defaultDate);

  return <TodayPageClient initialOrders={orders} initialDate={defaultDate} />;
}
