"use client";

import { useState } from "react";
import { Star, MessageSquare, Upload, X, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { createReviewAction } from "@/app/actions/feedback";
import { useRouter } from "next/navigation";

export type UserReviewItem = {
  id: string;
  rating: number;
  comment: string;
  photoUrl: string | null;
  status: string; // PENDING, APPROVED, REJECTED
  adminReply: string | null;
  adminReplyAt: Date | null;
  createdAt: Date;
};

type Props = {
  reviews: UserReviewItem[];
  hasEligibleOrders: boolean;
};

export default function ProfileReviewsSection({ reviews, hasEligibleOrders }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form state
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Будь ласка, виберіть файл зображення.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("Файл завеликий (максимум 10 МБ).");
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("rating", String(rating));
    formData.append("comment", comment);
    if (photoFile) {
      formData.append("photo", photoFile);
    }

    try {
      const res = await createReviewAction(formData);
      if (!res.ok) {
        setError(res.error || "Не вдалося зберегти відгук.");
      } else {
        setSuccessMsg("Дякуємо за відгук! Він надісланий на модерацію та незабаром з'явиться на сайті.");
        setComment("");
        removePhoto();
        setIsFormOpen(false);
        router.refresh();
      }
    } catch {
      setError("Помилка зв'язку із сервером. Спробуйте пізніше.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openSupport = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-support-widget"));
    }
  };

  return (
    <div className="mb-10 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 bg-white dark:bg-slate-900 shadow-sm transition-all overflow-hidden">
      {/* Accordion Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-6 sm:p-8 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
            <Star className="w-5 h-5 fill-current" />
          </div>
          <div className="text-left">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Мій відгук та підтримка
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Поділіться враженнями або зв'яжіться з нашою командою
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {reviews.length > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-bold">
              {reviews.length} {reviews.length === 1 ? "відгук" : "відгуки"}
            </span>
          )}
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 transition">
            {isOpen ? "▲" : "▼"}
          </div>
        </div>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="px-6 pb-6 sm:px-8 sm:pb-8 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-6">
          {/* Quick Support Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 dark:border-emerald-500/30">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Потрібна допомога?</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Маєте питання щодо доставки, заміни страв чи раціону?
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openSupport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              💬 Написати в підтримку
            </button>
          </div>

          {/* Success / Error Banners */}
          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Review Actions: Form or Eligibility Notice */}
          {!hasEligibleOrders ? (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-center space-y-2">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                ⭐ Залишити відгук
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Можливість оцінити сервіс відкриється після оформлення вашого першого замовлення раціону або абонемента.
              </p>
            </div>
          ) : (
            <div>
              {!isFormOpen ? (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Поділіться враженнями про Food Balance
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Ваш відгук допоможе нам ставати кращими та надихне інших клієнтів
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    ⭐ Написати відгук
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">Новий відгук</h4>
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Star Rating Picker */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Ваша оцінка
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 focus:outline-hidden cursor-pointer"
                        >
                          <Star
                            className={`h-7 w-7 transition-all ${
                              star <= (hoverRating || rating)
                                ? "fill-amber-400 text-amber-400 scale-110"
                                : "text-slate-300 dark:text-slate-600"
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-2">
                        {rating === 5
                          ? "Чудово (5 з 5)"
                          : rating === 4
                          ? "Добре (4 з 5)"
                          : rating === 3
                          ? "Нормально (3 з 5)"
                          : rating === 2
                          ? "Посередньо (2 з 5)"
                          : "Погано (1 з 5)"}
                      </span>
                    </div>
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Текст відгуку
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Опишіть смак страв, зручність доставки чи зміни у самопочутті..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition resize-none"
                    ></textarea>
                  </div>

                  {/* Photo Upload */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Фото страви чи результату (необов'язково)
                    </label>

                    {photoPreview ? (
                      <div className="relative inline-block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img
                          src={photoPreview}
                          alt="Прев'ю фото"
                          className="h-28 w-40 object-cover"
                        />
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black transition cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition cursor-pointer">
                        <Upload className="h-4 w-4" />
                        <span>Обрати файл (до 10 МБ)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      Скасувати
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? "Збереження..." : "Надіслати відгук"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* User's past reviews list */}
          {reviews.length > 0 && (
            <div className="space-y-4 pt-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Ваші надіслані відгуки:
              </h4>

              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-4 w-4 ${
                                s <= rev.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-300 dark:text-slate-600"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-slate-400">
                          {new Date(rev.createdAt).toLocaleDateString("uk-UA")}
                        </span>
                      </div>

                      {/* Status badge */}
                      <div>
                        {rev.status === "PENDING" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                            <Clock className="h-3 w-3" /> На модерації
                          </span>
                        )}
                        {rev.status === "APPROVED" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
                            <CheckCircle2 className="h-3 w-3" /> Опубліковано
                          </span>
                        )}
                        {rev.status === "REJECTED" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                            Відхилено
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {rev.comment}
                    </p>

                    {rev.photoUrl && (
                      <div className="pt-1">
                        <img
                          src={rev.photoUrl}
                          alt="Прикріплене фото"
                          className="h-24 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    )}

                    {/* Official Admin Reply */}
                    {rev.adminReply && (
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 p-3 space-y-1 mt-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Відповідь команди FoodBalance
                        </div>
                        <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90 leading-relaxed">
                          {rev.adminReply}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
