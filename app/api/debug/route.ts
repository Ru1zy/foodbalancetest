import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const latestIdempotency = await prisma.checkoutIdempotency.findMany({
      orderBy: { createdAt: "desc" },
      take: 5
    });
    const latestOrders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, isPaid: true, paymentMethod: true, status: true }
    });
    return NextResponse.json({ latestIdempotency, latestOrders });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
