import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

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

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching today orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
