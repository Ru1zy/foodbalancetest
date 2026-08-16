import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMonobankWebhook } from "@/lib/monobank";
import { enqueueOutboxJob, processAllOutboxJobs } from "@/lib/outbox";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("X-Sign");
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Basic verification - this can be expanded with ECDSA check
    if (!signature) {
      console.warn("Monobank webhook missing X-Sign header");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const isValid = await verifyMonobankWebhook(signature, Buffer.from(rawBody));
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const { reference, status } = body;
    if (!reference || !status) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Ignore non-final events but return 200 OK so Monobank doesn't retry
    if (status !== "success" && status !== "failure" && status !== "cancel") {
      return NextResponse.json({ received: true });
    }

    // Process the payment in a transaction for idempotency
    await prisma.$transaction(async (tx) => {
      // Check if reference is a SubscriptionPurchase
      const purchase = await tx.subscriptionPurchase.findUnique({
        where: { id: reference },
      });

      if (purchase) {
        if (purchase.status === "PAID" || purchase.status === "CANCELLED" || purchase.status === "FAILED") {
          console.log(`Monobank webhook: Subscription purchase ${reference} is already in final state ${purchase.status}. Idempotent return.`);
          return;
        }

        if (status === "success") {
          // Mark as PAID
          await tx.subscriptionPurchase.update({
            where: { id: reference },
            data: { status: "PAID" },
          });

          // Credit balance
          await tx.userBalance.upsert({
            where: {
              userId_packageId: { userId: purchase.userId, packageId: purchase.packageId },
            },
            create: {
              userId: purchase.userId,
              packageId: purchase.packageId,
              totalDays: purchase.days,
            },
            update: {
              totalDays: { increment: purchase.days },
            },
          });

          // Enqueue telegram notification for admin
          await enqueueOutboxJob(tx, "TELEGRAM_NOTIFICATION_SUBSCRIPTION", {
            purchaseId: purchase.id,
          });

          console.log(`Monobank webhook: Subscription purchase ${reference} marked as paid and days credited.`);
        } else {
          // status is failure or cancel
          await tx.subscriptionPurchase.update({
            where: { id: reference },
            data: { status: status === "cancel" ? "CANCELLED" : "FAILED" },
          });
          console.log(`Monobank webhook: Subscription purchase ${reference} marked as ${status}.`);
        }
        return;
      }

      // TODO: Handle one-off order payments if implemented
      // const order = await tx.order.findUnique({ where: { id: reference } });
      // if (order) { ... }
    });

    // Fire outbox processing in background
    processAllOutboxJobs().catch((err) => {
      console.error("processAllOutboxJobs error after Monobank webhook:", err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Monobank webhook failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
