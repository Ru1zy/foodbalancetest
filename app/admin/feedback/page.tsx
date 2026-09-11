import { redirect } from "next/navigation";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import FeedbackClient from "./FeedbackClient";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage(props: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const admin = await getAuthenticatedAdminUser();
  if (!admin) {
    redirect("/");
  }

  const searchParams = await props.searchParams;
  const activeTab = searchParams?.tab === "reviews" ? "reviews" : "tickets";

  const [tickets, reviews, openTicketsCount, pendingReviewsCount] = await Promise.all([
    prisma.supportTicket.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            chatId: true,
          },
        },
      },
    }),
    prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            chatId: true,
            avatarUrl: true,
          },
        },
      },
    }),
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.review.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            ⭐ Відгуки та підтримка
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Керування зверненнями клієнтів, модерація публічних відгуків та офіційні відповіді
          </p>
        </div>
      </div>

      <FeedbackClient
        initialTab={activeTab}
        tickets={tickets}
        reviews={reviews}
        openTicketsCount={openTicketsCount}
        pendingReviewsCount={pendingReviewsCount}
      />
    </div>
  );
}
