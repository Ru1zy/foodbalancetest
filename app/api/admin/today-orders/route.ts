import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { kyivDayRangeUtc, kyivTodayParts } from "@/lib/order-logic";

export async function GET(request: NextRequest) {
  try {
    const adminUser = await getAuthenticatedAdminUser();
    if (!adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateStr = searchParams.get("date");

    if (!dateStr) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

    // Parse date in DD.MM format
    const match = dateStr.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid date format. Use DD.MM" },
        { status: 400 }
      );
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);

    // Current year in the Kyiv calendar (the DD.MM input is implicitly "this year").
    const { year } = kyivTodayParts();

    // DST-aware Kyiv calendar-day window in real UTC instants — correct on
    // Vercel's UTC runtime and across the +02:00/+03:00 switch.
    const { start: targetDate, end: nextDay } = kyivDayRangeUtc(year, month, day);

    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: targetDate,
          lte: nextDay,
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

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching today orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
