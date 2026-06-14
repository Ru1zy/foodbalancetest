import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
    // Get today's midnight in Kyiv timezone
    const todayString = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kiev' });
    const todayMidnightKyiv = new Date(`${todayString}T00:00:00.000+03:00`);

    // Get date 7 days ago
    const sevenDaysAgo = new Date(todayMidnightKyiv);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

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
