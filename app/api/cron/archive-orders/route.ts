import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { kyivDayRangeUtc, kyivTodayParts } from "@/lib/order-logic";

/**
 * GitHub Actions cron endpoint for automatic order archiving.
 *
 * This runs daily at 2 AM UTC (5 AM Kyiv time in summer, 4 AM in winter).
 *
 * Authorization: requires the CRON_SECRET bearer token.
 */
export async function GET(request: Request) {
  // Fail closed: a missing deployment secret must never make this endpoint public.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron endpoint is not configured" },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Start of today's Kyiv calendar day as a real UTC instant (DST-aware).
    // No hardcoded +03:00 — that is wrong in winter (Kyiv is +02:00) and would
    // shift the archive boundary by an hour. This stays correct regardless of
    // the Railway container's local timezone.
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
          in: ordersToArchive.map((o: { id: string }) => o.id),
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
