import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { order_id, status } = body;

    // Example payload extraction (adjust according to actual LiqPay data)
    if (!order_id || !status) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (status !== "success" && status !== "wait_accept") {
      // Ignore non-success events but return 200 OK so LiqPay doesn't retry
      return NextResponse.json({ received: true });
    }

    // Use Prisma transaction to ensure idempotency and prevent double credits
    await prisma.$transaction(async (tx) => {
      // Determine what type of payment this is.
      // If order_id maps to an Order record:
      const order = await tx.order.findUnique({
        where: { id: order_id },
      });

      if (order) {
        if (order.isPaid) {
          console.log(`LiqPay webhook: Order ${order_id} is already paid. Idempotent return.`);
          return; // Idempotent: already processed
        }

        await tx.order.update({
          where: { id: order_id },
          data: { isPaid: true },
        });

        console.log(`LiqPay webhook: Order ${order_id} marked as paid.`);
        
        // Example: trigger a notification or enqueue a job
        // await tx.outboxJob.create({ ... })
        return;
      }

      // If order_id maps to a Balance Top-Up:
      // const topup = await tx.balanceTopUp.findUnique({ where: { id: order_id } });
      // if (topup && topup.status === "PENDING") { ... }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LiqPay webhook failed:", error);
    // Return 500 so LiqPay retries later if it was a genuine processing error
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
