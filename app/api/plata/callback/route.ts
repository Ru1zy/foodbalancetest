import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMonobankWebhook } from "@/lib/monobank";
import { enqueueOutboxJob, processAllOutboxJobs } from "@/lib/outbox";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("X-Sign");
    const rawBodyBuffer = await request.arrayBuffer();
    const rawBody = Buffer.from(rawBodyBuffer);
    const bodyText = rawBody.toString('utf-8');
    const body = JSON.parse(bodyText);

    // Basic verification - this can be expanded with ECDSA check
    if (!signature) {
      console.warn("Monobank webhook missing X-Sign header");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const isValid = await verifyMonobankWebhook(signature, rawBody);
    if (!isValid) {
      console.warn("Monobank webhook signature invalid for body:", bodyText);
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

      // Check if reference is a CheckoutIdempotency key (for multi-order checkout)
      const idempotency = await tx.checkoutIdempotency.findUnique({
        where: { key: reference },
      });

      if (idempotency && idempotency.orderIds.length > 0) {
        if (status === "success") {
          // Check if orders are already paid
          const existingOrders = await tx.order.findMany({
            where: { id: { in: idempotency.orderIds } },
            select: { isPaid: true }
          });
          
          const allPaid = existingOrders.length > 0 && existingOrders.every(o => o.isPaid);
          if (allPaid) {
            console.log(`Monobank webhook: Checkout ${reference} is already paid. Idempotent return.`);
            return;
          }

          await tx.order.updateMany({
            where: { id: { in: idempotency.orderIds } },
            data: { isPaid: true },
          });

          // Enqueue telegram notification for admin
          await enqueueOutboxJob(tx, "TELEGRAM_NOTIFICATION", {
            orderIds: idempotency.orderIds,
          });

          console.log(`Monobank webhook: Checkout ${reference} marked as paid.`);
        } else {
          console.log(`Monobank webhook: Checkout ${reference} payment ${status}.`);
        }
        return;
      }
    });

    // Fire outbox processing in background
    processAllOutboxJobs().catch((err) => {
      console.error("processAllOutboxJobs error after Monobank webhook:", err);
    });

    // Clear the cache so the UI updates
    revalidatePath("/admin/orders");
    revalidatePath("/admin/today");
    revalidatePath("/");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Monobank webhook failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
