import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const purchaseId = url.searchParams.get("id");

  if (!purchaseId) {
    const pending = await prisma.subscriptionPurchase.findMany({
      where: { status: "CREDITED_PENDING_CONFIRMATION" },
      select: { id: true, packageId: true, days: true }
    });
    return NextResponse.json({ message: "Provide ?id=", pending });
  }

  try {
    const purchase = await prisma.subscriptionPurchase.findUnique({
      where: { id: purchaseId }
    });

    if (!purchase) return NextResponse.json({ error: "Not found" });

    let errMessage = "No error";
    try {
      await prisma.$transaction(async (tx) => {
        await tx.subscriptionPurchase.update({
          where: { id: purchaseId },
          data: { status: "CANCELLED", confirmedBy: "Test", confirmedAt: new Date() },
        });

        await tx.userBalance.update({
          where: {
            userId_packageId: { userId: purchase.userId, packageId: purchase.packageId },
          },
          data: {
            totalDays: { decrement: purchase.days },
          },
        });
        
        throw new Error("ROLLBACK_TEST");
      });
    } catch (e: any) {
      if (e.message !== "ROLLBACK_TEST") {
        errMessage = e.message;
      }
    }

    return NextResponse.json({ success: true, errMessage, purchase });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack });
  }
}
