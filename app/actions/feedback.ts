"use server";

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyAuthToken } from "@/lib/auth-token";
import { sendAdminAlert } from "@/lib/telegram";
import { uploadPublicObject } from "@/lib/storage";
import { sanitizeTelegramPhone } from "@/lib/telegram-phone";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function createSupportTicketAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const contact = String(formData.get("contact") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!name || name.length < 2) {
    return { ok: false, error: "Будь ласка, вкажіть ваше ім'я (мінімум 2 символи)." };
  }
  if (!contact || contact.length < 3) {
    return { ok: false, error: "Будь ласка, вкажіть контакт для зв'язку (телефон, Telegram або email)." };
  }
  if (!message || message.length < 5) {
    return { ok: false, error: "Будь ласка, опишіть ваше питання (мінімум 5 символів)." };
  }

  // Check if current user is logged in
  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (token) {
      const verified = await verifyAuthToken(token);
      if (verified) {
        userId = verified;
      }
    }
  } catch {
    // Guest submission
  }

  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        name,
        contact,
        message,
        status: "OPEN",
      },
    });

    // Notify administrators in Telegram
    const isClient = Boolean(userId);
    const alertMessage =
      `<b>💬 Нове звернення з сайту!</b>\n\n` +
      `👤 <b>Ім'я:</b> ${escapeHtml(name)}\n` +
      `📞 <b>Контакт:</b> ${escapeHtml(contact)}\n` +
      (isClient ? `🟢 <b>Зареєстрований клієнт</b>\n` : `⚪ <b>Гість сайту</b>\n`) +
      `\n📝 <b>Повідомлення:</b>\n${escapeHtml(message)}\n\n` +
      `🎯 <i>Перегляньте звернення в адмінці: вкладка «Звернення»</i>`;

    sendAdminAlert(alertMessage).catch((err) =>
      console.error("Failed to send admin alert for support ticket:", err)
    );

    return { ok: true, ticketId: ticket.id };
  } catch (error: unknown) {
    console.error("Error creating support ticket:", error);
    return { ok: false, error: "Не вдалося надіслати звернення. Спробуйте пізніше." };
  }
}

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function createReviewAction(formData: FormData) {
  let userId: string;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) {
      return { ok: false, error: "Для залишення відгуку необхідно увійти в акаунт." };
    }
    const verified = await verifyAuthToken(token);
    if (!verified) {
      return { ok: false, error: "Недійсний сеанс. Будь ласка, увійдіть знову." };
    }
    userId = verified;
  } catch {
    return { ok: false, error: "Помилка авторизації." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, phone: true },
  });

  if (!user) {
    return { ok: false, error: "Користувача не знайдено." };
  }

  // Check eligibility: user must have at least 1 order or subscription
  const [ordersCount, subsCount] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.subscriptionPurchase.count({ where: { userId } }),
  ]);

  if (ordersCount === 0 && subsCount === 0) {
    return {
      ok: false,
      error: "Залишити відгук можуть лише клієнти, які вже оформлювали замовлення раціону або абонемент.",
    };
  }

  const ratingRaw = parseInt(String(formData.get("rating") || "5"), 10);
  const rating = Math.min(5, Math.max(1, isNaN(ratingRaw) ? 5 : ratingRaw));
  const comment = String(formData.get("comment") || "").trim();

  if (!comment || comment.length < 5) {
    return { ok: false, error: "Будь ласка, напишіть відгук (мінімум 5 символів)." };
  }

  let photoUrl: string | null = null;
  const photoFile = formData.get("photo") as File | null;

  if (photoFile && photoFile.size > 0) {
    if (!photoFile.type.startsWith("image/")) {
      return { ok: false, error: "Файл повинен бути зображенням (PNG, JPG, WEBP)." };
    }
    if (photoFile.size > MAX_PHOTO_SIZE_BYTES) {
      return { ok: false, error: "Розмір фото завеликий. Максимальний розмір — 10 МБ." };
    }

    try {
      const uploadRes = await uploadPublicObject(photoFile, { prefix: "reviews" });
      photoUrl = uploadRes.url;
    } catch (err) {
      console.error("Failed to upload review photo:", err);
      return { ok: false, error: "Не вдалося завантажити фото. Спробуйте без нього або інший файл." };
    }
  }

  try {
    const review = await prisma.review.create({
      data: {
        userId,
        rating,
        comment,
        photoUrl,
        status: "PENDING",
      },
    });

    const stars = "⭐".repeat(rating);
    const cleanPhone = sanitizeTelegramPhone(user.phone);
    const alertMessage =
      `<b>⭐ Новий відгук на модерацію!</b>\n\n` +
      `👤 <b>Клієнт:</b> ${escapeHtml(user.name)} (${escapeHtml(cleanPhone)})\n` +
      `⭐ <b>Оцінка:</b> ${stars} (${rating}/5)\n\n` +
      `💬 <b>Відгук:</b>\n${escapeHtml(comment)}\n` +
      (photoUrl ? `\n📷 <i>До відгуку прикріплено фото</i>\n` : "") +
      `\n🎯 <i>Модерувати в адмінці: вкладка «Відгуки»</i>`;

    sendAdminAlert(alertMessage).catch((err) =>
      console.error("Failed to send admin alert for review:", err)
    );

    return { ok: true, reviewId: review.id };
  } catch (error: unknown) {
    console.error("Error creating review:", error);
    return { ok: false, error: "Не вдалося зберегти відгук. Спробуйте пізніше." };
  }
}

export async function getPublicReviewsAction() {
  try {
    const reviews = await prisma.review.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    const totalCount = reviews.length;
    const avgRating =
      totalCount > 0
        ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / totalCount).toFixed(1))
        : 5.0;

    return {
      ok: true,
      reviews: reviews.map((r) => ({
        id: r.id,
        userName: r.user.name,
        userAvatar: r.user.avatarUrl,
        rating: r.rating,
        comment: r.comment,
        photoUrl: r.photoUrl,
        adminReply: r.adminReply,
        adminReplyAt: r.adminReplyAt,
        createdAt: r.createdAt,
      })),
      summary: {
        totalCount,
        avgRating,
      },
    };
  } catch (error: unknown) {
    console.error("Error fetching public reviews:", error);
    return { ok: false, reviews: [], summary: { totalCount: 0, avgRating: 5.0 } };
  }
}

export async function getUserReviewsAction() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return { ok: false, reviews: [] };
    const userId = await verifyAuthToken(token);
    if (!userId) return { ok: false, reviews: [] };

    const reviews = await prisma.review.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return { ok: true, reviews };
  } catch (error: unknown) {
    console.error("Error fetching user reviews:", error);
    return { ok: false, reviews: [] };
  }
}
