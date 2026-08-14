import prisma from "./prisma";
import type { Prisma } from "@prisma/client";
import { syncClientToSheet, appendOrderToSheet } from "./googleSheets";
import { syncOrderToMonthlySheets } from "./monthlySheets";
import { sendSubscriptionPendingAlert } from "./telegram";

/**
 * Enqueues an outbox job within a Prisma transaction.
 * 
 * @param tx The Prisma transaction client
 * @param type The type of the job (e.g. "SYNC_CRM_ORDER")
 * @param payload The job payload
 */
export async function enqueueOutboxJob(
  tx: Prisma.TransactionClient,
  type: string,
  payload: unknown
) {
  return tx.outboxJob.create({
    data: {
      type,
      payload: payload as Prisma.InputJsonValue,
      status: "PENDING",
    },
  });
}

/**
 * Processes a single outbox job.
 */
export async function processOutboxJob(jobId: string) {
  const job = await prisma.outboxJob.findUnique({ where: { id: jobId } });
  if (!job || (job.status !== "PENDING" && job.status !== "FAILED")) return;

  // Mark as processing
  await prisma.outboxJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING" },
  });

  try {
    if (job.type === "SYNC_CRM_ORDER") {
      const payload = job.payload as { orderId?: string };
      const orderId = payload.orderId;
      if (!orderId) {
        throw new Error("Missing orderId in payload");
      }
      
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true },
      });
      
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Sync Client Profile
      await syncClientToSheet({
        name: order.user.name,
        phone: order.user.phone,
        address: order.deliveryAddress || order.user.address || "",
        chatId: order.user.chatId || "",
        packageType: order.packageType,
        cutlery: order.cutlery,
        notes: order.notes || "",
      });

      // Append to Orders CRM tab
      await appendOrderToSheet(order, order.user);

      // Export to Monthly tabs
      await syncOrderToMonthlySheets(order, order.user);
    } else if (job.type === "TELEGRAM_NOTIFICATION_SUBSCRIPTION") {
      const payload = job.payload as { purchaseId?: string };
      if (!payload.purchaseId) throw new Error("Missing purchaseId");

      const purchase = await prisma.subscriptionPurchase.findUnique({
        where: { id: payload.purchaseId },
        include: { user: true },
      });

      if (purchase) {
        await sendSubscriptionPendingAlert(purchase, purchase.user);
      }
    } else if (job.type === "TELEGRAM_NOTIFICATION_SUBSCRIPTION_RESULT") {
      const payload = job.payload as { purchaseId?: string; approved?: boolean };
      if (!payload.purchaseId) throw new Error("Missing purchaseId");

      const purchase = await prisma.subscriptionPurchase.findUnique({
        where: { id: payload.purchaseId },
        include: { user: true },
      });

      if (purchase && purchase.user.chatId) {
        const { sendSubscriptionApprovedAlert, sendSubscriptionRejectedAlert } = await import('./telegram');
        if (payload.approved) {
           await sendSubscriptionApprovedAlert(purchase, purchase.user);
        } else {
           await sendSubscriptionRejectedAlert(purchase, purchase.user);
        }
      }
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    // Mark completed
    await prisma.outboxJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED", error: null },
    });
  } catch (error: unknown) {
    console.error(`Failed to process outbox job ${jobId}:`, error);
    await prisma.outboxJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
        retries: { increment: 1 },
      },
    });
  }
}

/**
 * Finds all pending or failed (but retriable) outbox jobs and processes them.
 */
export async function processAllOutboxJobs() {
  const maxRetries = 5;
  const jobs = await prisma.outboxJob.findMany({
    where: {
      OR: [
        { status: "PENDING" },
        { status: "FAILED", retries: { lt: maxRetries } }
      ]
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  for (const job of jobs) {
    await processOutboxJob(job.id);
  }
}
