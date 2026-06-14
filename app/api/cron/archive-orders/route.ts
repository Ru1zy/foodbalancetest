import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { kyivDayRangeUtc, kyivTodayParts } from "@/lib/order-logic";

/**
 * Vercel Cron Job endpoint for automatic order archiving.
 *
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/archive-orders",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 *
 * This runs daily at 2 AM UTC (5 AM Kyiv time in summer, 4 AM in winter).
 *
 * Authorization: Vercel Cron requests include a special header.
 * For additional security, you can check process.env.CRON_SECRET.
 */
export async function GET(request: Request) {
  // Verify this is a legitimate Vercel Cron request
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Start of today's Kyiv calendar day as a real UTC instant (DST-aware).
    // No hardcoded +03:00 — that is wrong in winter (Kyiv is +02:00) and would
    // shift the archive boundary by an hour. Runs correctly on Vercel's UTC.
    const { year, month, day } = kyivTodayParts();
    const todayMidnightKyiv = kyivDayRangeUtc(year, month, day).start;

    // Cutoff for abandoned-cart cleanup: 7 calendar days earlier.
    const sevenDaysAgo = new Date(todayMidnightKyiv.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Find orders to archive: past delivery date, paid or delivered/processed
    const ordersToArchive = await prisma.order.findMany({
      where: {
        deliveryDate: {
          lt: todayMidnightKyiv,
        },
        status: {
          not: "archived",
        },
        OR: [
          { isPaid: true },
          { status: { in: ["delivered", "processed", "Оплачено", "Доставлено"] } },
        ],
      },
      select: {
        id: true,
      },
    });

    // Archive them
    const archivedResult = await prisma.order.updateMany({
      where: {
        id: {
          in: ordersToArchive.map(o => o.id),
        },
      },
      data: {
        status: "archived",
      },
    });

    // Find abandoned carts to delete: older than 7 days, not paid, not processed
    const deletedResult = await prisma.order.deleteMany({
      where: {
        deliveryDate: {
          lt: sevenDaysAgo,
        },
        isPaid: false,
        status: {
          notIn: ["delivered", "processed", "archived", "Оплачено", "Доставлено"],
        },
      },
    });

    return NextResponse.json({
      success: true,
      archived: archivedResult.count,
      deleted: deletedResult.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job archive-orders failed", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
