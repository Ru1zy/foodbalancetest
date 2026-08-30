import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 1
    });
    return NextResponse.json({ orders });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
