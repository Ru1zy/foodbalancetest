import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMonobankWebhook, calculateAmountWithFee } from "@/lib/monobank";
import { enqueueOutboxJob, processAllOutboxJobs } from "@/lib/outbox";
import { syncOrderStatusInSheet } from "@/lib/googleSheets";
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

    const { reference, status, ccy, amount } = body;
    if (!reference || !status) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Verify currency is UAH (980)
    if (ccy !== undefined && ccy !== 980) {
      console.warn(`Monobank webhook invalid currency: ${ccy}`);
      return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
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
          const expectedPennies = Math.round(calculateAmountWithFee(purchase.finalPrice) * 100);
          if (typeof amount === "number" && amount < expectedPennies) {
            console.error(
              `Monobank webhook underpayment for purchase ${reference}: expected ${expectedPennies}, got ${amount}`
            );
            return;
          }

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
            select: { id: true, price: true, isPaid: true },
          });

          const isAdminInvoice = reference.startsWith("admin_inv_");
          if (!isAdminInvoice) {
            const totalUah = existingOrders.reduce((sum, o) => sum + (o.price || 0), 0);
            const expectedPennies = Math.round(calculateAmountWithFee(totalUah) * 100);
            if (typeof amount === "number" && amount < expectedPennies) {
              console.error(
                `Monobank webhook underpayment for checkout ${reference}: expected ${expectedPennies}, got ${amount}`
              );
              return;
            }
          }

          const allPaid = existingOrders.length > 0 && existingOrders.every((o) => o.isPaid);
          if (allPaid) {
            console.log(`Monobank webhook: Checkout ${reference} is already paid. Idempotent return.`);
            return;
          }

          await tx.order.updateMany({
            where: { id: { in: idempotency.orderIds } },
            data: { isPaid: true, paymentMethod: "plata" },
          });

          // Sync paid status to Google Sheets Orders tab
          for (const o of existingOrders) {
            syncOrderStatusInSheet(o.id, "Оплачено", true).catch((err) =>
              console.error("syncOrderStatusInSheet failed in plata callback:", err)
            );
          }

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

      // Check if reference is directly an Order ID
      const singleOrder = await tx.order.findUnique({
        where: { id: reference },
        select: { id: true, price: true, isPaid: true },
      });

      if (singleOrder) {
        if (status === "success") {
          if (singleOrder.isPaid) {
            console.log(`Monobank webhook: Order ${reference} is already paid. Idempotent return.`);
            return;
          }

          await tx.order.update({
            where: { id: reference },
            data: { isPaid: true, paymentMethod: "plata" },
          });

          syncOrderStatusInSheet(singleOrder.id, "Оплачено", true).catch((err) =>
            console.error("syncOrderStatusInSheet failed in plata callback:", err)
          );

          await enqueueOutboxJob(tx, "TELEGRAM_NOTIFICATION", {
            orderIds: [singleOrder.id],
          });

          console.log(`Monobank webhook: Order ${reference} marked as paid.`);
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
