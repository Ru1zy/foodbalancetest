"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Star,
  Clock,
  CheckCircle2,
  XCircle,
  Phone,
  Trash2,
  Send,
  X,
  User,
  ExternalLink,
} from "lucide-react";
import { FaTelegram } from "react-icons/fa";
import {
  updateTicketStatusAction,
  deleteTicketAction,
  moderateReviewAction,
  replyToReviewAction,
  deleteReviewAction,
} from "@/app/actions/admin-feedback";
import { sanitizeTelegramPhone } from "@/lib/telegram-phone";

type Ticket = {
  id: string;
  userId: string | null;
  name: string;
  contact: string;
  message: string;
  status: string; // OPEN, IN_PROGRESS, RESOLVED
  adminNotes: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    phone: string;
    chatId: string | null;
  } | null;
};

type Review = {
  id: string;
  userId: string;
  rating: number;
  comment: string;
  photoUrl: string | null;
  status: string; // PENDING, APPROVED, REJECTED
  adminReply: string | null;
  adminReplyAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    phone: string;
    chatId: string | null;
    avatarUrl: string | null;
  };
};

type Props = {
  initialTab: "tickets" | "reviews";
  tickets: Ticket[];
  reviews: Review[];
  openTicketsCount: number;
  pendingReviewsCount: number;
};

export default function FeedbackClient({
  initialTab,
  tickets,
  reviews,
  openTicketsCount,
  pendingReviewsCount,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"tickets" | "reviews">(initialTab);

  // Tickets filtering & state
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>("ALL");
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [actionProcessingId, setActionProcessingId] = useState<string | null>(null);

  // Reviews filtering & state
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>("PENDING");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const handleTabChange = (tab: "tickets" | "reviews") => {
    setActiveTab(tab);
    router.push(`/admin/feedback?tab=${tab}`);
  };

  // --- Ticket Actions ---
  const handleUpdateTicketStatus = async (
    ticketId: string,
    newStatus: "OPEN" | "IN_PROGRESS" | "RESOLVED"
  ) => {
    setActionProcessingId(ticketId);
    const res = await updateTicketStatusAction(ticketId, newStatus);
    if (!res.ok) {
      alert(res.error || "Помилка зміни статусу");
    }
    setActionProcessingId(null);
    router.refresh();
  };

  const handleSaveNotes = async (ticketId: string) => {
    setActionProcessingId(ticketId);
    const currentTicket = tickets.find((t) => t.id === ticketId);
    const currentStatus = (currentTicket?.status as "OPEN" | "IN_PROGRESS" | "RESOLVED") || "OPEN";
    const res = await updateTicketStatusAction(
      ticketId,
      currentStatus,
      notesDraft
    );
    if (!res.ok) {
      alert(res.error || "Помилка збереження примітки");
    } else {
      setEditingNotesId(null);
    }
    setActionProcessingId(null);
    router.refresh();
  };

  const handleDeleteTicket = async (ticketId: string) => {
    setActionProcessingId(ticketId);
    const res = await deleteTicketAction(ticketId);
    if (!res.ok) {
      alert(res.error || "Помилка видалення");
    }
    setActionProcessingId(null);
    router.refresh();
  };

  // --- Review Actions ---
  const handleModerateReview = async (
    reviewId: string,
    status: "APPROVED" | "REJECTED" | "PENDING"
  ) => {
    setActionProcessingId(reviewId);
    const draftText = replyDrafts[reviewId];
    const res = await moderateReviewAction(reviewId, status, draftText);
    if (!res.ok) {
      alert(res.error || "Помилка модерації відгуку");
    }
    setActionProcessingId(null);
    router.refresh();
  };

  const handleSaveReply = async (reviewId: string) => {
    const review = reviews.find((r) => r.id === reviewId);
    const text = replyDrafts[reviewId] !== undefined ? replyDrafts[reviewId] : (review?.adminReply || "");
    setActionProcessingId(reviewId);
    const res = await replyToReviewAction(reviewId, text);
    if (!res.ok) {
      alert(res.error || "Помилка збереження відповіді");
    }
    setActionProcessingId(null);
    router.refresh();
  };

  const handleDeleteReview = async (reviewId: string) => {
    setActionProcessingId(reviewId);
    const res = await deleteReviewAction(reviewId);
    if (!res.ok) {
      alert(res.error || "Помилка видалення відгуку");
    }
    setActionProcessingId(null);
    router.refresh();
  };

  // Filtered lists
  const filteredTickets = tickets.filter((t) => {
    if (ticketStatusFilter === "ALL") return true;
    return t.status === ticketStatusFilter;
  });

  const filteredReviews = reviews.filter((r) => {
    if (reviewStatusFilter === "ALL") return true;
    return r.status === reviewStatusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Category Tabs: Tickets vs Reviews */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
        <button
          type="button"
          onClick={() => handleTabChange("tickets")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "tickets"
              ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Звернення (тікети)</span>
          {openTicketsCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-emerald-600 text-white">
              {openTicketsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("reviews")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "reviews"
              ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Star className="h-4 w-4 fill-current" />
          <span>Відгуки (модерація)</span>
          {pendingReviewsCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-amber-500 text-white">
              {pendingReviewsCount}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: TICKETS / ЗВЕРНЕННЯ                               */}
      {/* ========================================================= */}
      {activeTab === "tickets" && (
        <div className="space-y-4">
          {/* Status Filter Subtabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "ALL", label: `Усі (${tickets.length})` },
              {
                id: "OPEN",
                label: `Нові (${tickets.filter((t) => t.status === "OPEN").length})`,
              },
              {
                id: "IN_PROGRESS",
                label: `В процесі (${tickets.filter((t) => t.status === "IN_PROGRESS").length})`,
              },
              {
                id: "RESOLVED",
                label: `Вирішені (${tickets.filter((t) => t.status === "RESOLVED").length})`,
              },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTicketStatusFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  ticketStatusFilter === f.id
                    ? "bg-slate-900 dark:bg-slate-700 text-white"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredTickets.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
              Звернень із вибраним статусом немає.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTickets.map((ticket) => {
                const isProcessing = actionProcessingId === ticket.id;
                const isClient = Boolean(ticket.userId);

                return (
                  <div
                    key={ticket.id}
                    className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-2xl font-bold text-sm ${
                            isClient
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-slate-900 dark:text-white">
                              {ticket.name}
                            </h3>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isClient
                                  ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {isClient ? "Клієнт" : "Гість"}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {new Date(ticket.createdAt).toLocaleString("uk-UA", {
                              day: "numeric",
                              month: "long",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div className="flex items-center gap-2">
                        {ticket.status === "OPEN" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold">
                            <Clock className="h-3.5 w-3.5" /> Нове звернення
                          </span>
                        )}
                        {ticket.status === "IN_PROGRESS" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 text-xs font-bold">
                            <Clock className="h-3.5 w-3.5" /> В роботі
                          </span>
                        )}
                        {ticket.status === "RESOLVED" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Вирішено
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteTicket(ticket.id)}
                          disabled={isProcessing}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="Видалити звернення"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Contact & Message */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Контакт для зв'язку
                        </span>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white break-all">
                          {ticket.contact}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <a
                            href={`tel:${ticket.contact.replace(/[^\d+]/g, "")}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-200 transition"
                          >
                            <Phone className="h-3 w-3" /> Дзвінок
                          </a>
                          {ticket.contact.includes("@") ? (
                            <a
                              href={`https://t.me/${ticket.contact.replace("@", "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 text-xs font-bold hover:bg-sky-200 transition"
                            >
                              <FaTelegram className="h-3 w-3" /> Telegram
                            </a>
                          ) : null}
                          {ticket.user?.phone && (
                            <div className="text-[11px] text-slate-400">
                              (тел. клієнта: {sanitizeTelegramPhone(ticket.user.phone)})
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Текст звернення
                        </span>
                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {ticket.message}
                        </p>
                      </div>
                    </div>

                    {/* Admin Notes Section */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        {editingNotesId === ticket.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={notesDraft}
                              onChange={(e) => setNotesDraft(e.target.value)}
                              placeholder="Внутрішня примітка (видно тільки адміну)..."
                              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-900 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveNotes(ticket.id)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                            >
                              Зберегти
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNotesId(null)}
                              className="px-2 py-1.5 text-xs text-slate-400 cursor-pointer"
                            >
                              Скасувати
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingNotesId(ticket.id);
                              setNotesDraft(ticket.adminNotes || "");
                            }}
                            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer flex items-center gap-1.5"
                          >
                            <span>📝 Примітка адміна:</span>
                            <span className="italic font-medium text-slate-700 dark:text-slate-300">
                              {ticket.adminNotes || "Додати примітку..."}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 1-Click Status Changing Actions */}
                      <div className="flex items-center gap-2">
                        {ticket.status === "OPEN" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateTicketStatus(ticket.id, "IN_PROGRESS")}
                              disabled={isProcessing}
                              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                            >
                              Взяти в роботу
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateTicketStatus(ticket.id, "RESOLVED")}
                              disabled={isProcessing}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                            >
                              ✓ Вирішено
                            </button>
                          </>
                        )}

                        {ticket.status === "IN_PROGRESS" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateTicketStatus(ticket.id, "RESOLVED")}
                              disabled={isProcessing}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                            >
                              ✓ Вирішено
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateTicketStatus(ticket.id, "OPEN")}
                              disabled={isProcessing}
                              className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                            >
                              Повернути в нові
                            </button>
                          </>
                        )}

                        {ticket.status === "RESOLVED" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateTicketStatus(ticket.id, "OPEN")}
                            disabled={isProcessing}
                            className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                          >
                            Відкрити знову
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: REVIEWS / ВІДГУКИ (МОДЕРАЦІЯ)                       */}
      {/* ========================================================= */}
      {activeTab === "reviews" && (
        <div className="space-y-4">
          {/* Status Filter Subtabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              {
                id: "PENDING",
                label: `На модерації (${reviews.filter((r) => r.status === "PENDING").length})`,
              },
              {
                id: "APPROVED",
                label: `Схвалені (${reviews.filter((r) => r.status === "APPROVED").length})`,
              },
              {
                id: "REJECTED",
                label: `Відхилені (${reviews.filter((r) => r.status === "REJECTED").length})`,
              },
              { id: "ALL", label: `Усі (${reviews.length})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setReviewStatusFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  reviewStatusFilter === f.id
                    ? "bg-slate-900 dark:bg-slate-700 text-white"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredReviews.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
              Відгуків із вибраним статусом немає.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map((review) => {
                const isProcessing = actionProcessingId === review.id;
                const draft =
                  replyDrafts[review.id] !== undefined
                    ? replyDrafts[review.id]
                    : review.adminReply || "";

                return (
                  <div
                    key={review.id}
                    className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-base">
                          {review.user.avatarUrl ? (
                            <img
                              src={review.user.avatarUrl}
                              alt={review.user.name}
                              className="h-full w-full object-cover rounded-2xl"
                            />
                          ) : (
                            review.user.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-slate-900 dark:text-white">
                              {review.user.name}
                            </h3>
                            <span className="text-xs text-slate-400 font-medium">
                              ({sanitizeTelegramPhone(review.user.phone)})
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {new Date(review.createdAt).toLocaleString("uk-UA", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Status & Rating */}
                      <div className="flex items-center gap-3">
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-4 w-4 ${
                                s <= review.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-300 dark:text-slate-700"
                              }`}
                            />
                          ))}
                        </div>

                        {review.status === "PENDING" && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold">
                            ⏳ На модерації
                          </span>
                        )}
                        {review.status === "APPROVED" && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                            ✅ Схвалено
                          </span>
                        )}
                        {review.status === "REJECTED" && (
                          <span className="px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-xs font-bold">
                            ❌ Відхилено
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteReview(review.id)}
                          disabled={isProcessing}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="Видалити відгук"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Review Comment & Photo */}
                    <div className="space-y-3">
                      <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {review.comment}
                      </p>

                      {review.photoUrl && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoUrl(review.photoUrl)}
                            className="relative group block rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 cursor-pointer"
                          >
                            <img
                              src={review.photoUrl}
                              alt="Фото страви від клієнта"
                              className="h-32 rounded-2xl object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold">
                              🔍 Переглянути фото
                            </div>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Moderation Action Buttons (1 click, no confirm) */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {review.status !== "APPROVED" && (
                        <button
                          type="button"
                          onClick={() => handleModerateReview(review.id, "APPROVED")}
                          disabled={isProcessing}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                        >
                          🟢 Опублікувати на сайті
                        </button>
                      )}

                      {review.status !== "REJECTED" && (
                        <button
                          type="button"
                          onClick={() => handleModerateReview(review.id, "REJECTED")}
                          disabled={isProcessing}
                          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                        >
                          🔴 Відхилити
                        </button>
                      )}

                      {review.status !== "PENDING" && (
                        <button
                          type="button"
                          onClick={() => handleModerateReview(review.id, "PENDING")}
                          disabled={isProcessing}
                          className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                        >
                          Повернути на модерацію
                        </button>
                      )}
                    </div>

                    {/* Admin Reply Section */}
                    <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          👨‍🍳 Офіційна відповідь клієнту (буде показана під коментарем):
                        </span>
                        {review.adminReplyAt && (
                          <span className="text-[11px] text-slate-400">
                            Відповіли: {new Date(review.adminReplyAt).toLocaleDateString("uk-UA")}
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={draft}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({
                            ...prev,
                            [review.id]: e.target.value,
                          }))
                        }
                        placeholder="Наприклад: Дякуємо за теплий відгук! Раді, що страви сподобалися. Чекаємо на нові замовлення!"
                        className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden transition resize-none"
                      ></textarea>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSaveReply(review.id)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                        >
                          <Send className="h-3 w-3" />
                          <span>{review.adminReply ? "Оновити відповідь" : "Зберегти відповідь"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lightbox for Photo Preview */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white transition cursor-pointer"
            >
              <X className="h-7 w-7" />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Збільшене фото відгуку"
              className="max-h-[85vh] w-auto object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
