"use server";

import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

async function ensureAdmin() {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    throw new Error("Неавторизований доступ. Потрібні права адміністратора.");
  }
  return admin;
}

export async function updateTicketStatusAction(
  ticketId: string,
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED",
  adminNotes?: string
) {
  try {
    await ensureAdmin();

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        ...(adminNotes !== undefined ? { adminNotes } : {}),
      },
    });

    revalidatePath("/admin/feedback");
    return { ok: true };
  } catch (error: unknown) {
    console.error("Error updating ticket status:", error);
    const message = error instanceof Error ? error.message : "Помилка оновлення статусу";
    return { ok: false, error: message };
  }
}

export async function deleteTicketAction(ticketId: string) {
  try {
    await ensureAdmin();

    await prisma.supportTicket.delete({
      where: { id: ticketId },
    });

    revalidatePath("/admin/feedback");
    return { ok: true };
  } catch (error: unknown) {
    console.error("Error deleting ticket:", error);
    const message = error instanceof Error ? error.message : "Помилка видалення звернення";
    return { ok: false, error: message };
  }
}

export async function moderateReviewAction(
  reviewId: string,
  status: "APPROVED" | "REJECTED" | "PENDING",
  adminReply?: string
) {
  try {
    await ensureAdmin();

    const data: {
      status: string;
      adminReply?: string | null;
      adminReplyAt?: Date | null;
    } = { status };

    if (adminReply !== undefined) {
      const trimmed = adminReply.trim();
      data.adminReply = trimmed.length > 0 ? trimmed : null;
      data.adminReplyAt = trimmed.length > 0 ? new Date() : null;
    }

    await prisma.review.update({
      where: { id: reviewId },
      data,
    });

    revalidatePath("/admin/feedback");
    revalidatePath("/");
    return { ok: true };
  } catch (error: unknown) {
    console.error("Error moderating review:", error);
    const message = error instanceof Error ? error.message : "Помилка модерації відгуку";
    return { ok: false, error: message };
  }
}

export async function replyToReviewAction(
  reviewId: string,
  adminReply: string
) {
  try {
    await ensureAdmin();

    const trimmed = adminReply.trim();

    await prisma.review.update({
      where: { id: reviewId },
      data: {
        adminReply: trimmed.length > 0 ? trimmed : null,
        adminReplyAt: trimmed.length > 0 ? new Date() : null,
      },
    });

    revalidatePath("/admin/feedback");
    revalidatePath("/");
    return { ok: true };
  } catch (error: unknown) {
    console.error("Error saving admin reply:", error);
    const message = error instanceof Error ? error.message : "Помилка збереження відповіді";
    return { ok: false, error: message };
  }
}

export async function deleteReviewAction(reviewId: string) {
  try {
    await ensureAdmin();

    await prisma.review.delete({
      where: { id: reviewId },
    });

    revalidatePath("/admin/feedback");
    revalidatePath("/");
    return { ok: true };
  } catch (error: unknown) {
    console.error("Error deleting review:", error);
    const message = error instanceof Error ? error.message : "Помилка видалення відгуку";
    return { ok: false, error: message };
  }
}
