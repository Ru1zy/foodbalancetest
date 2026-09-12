"use client";

import { useEffect, useState } from "react";
import { Star, MessageCircle, X, ChevronRight, CheckCircle2 } from "lucide-react";
import { getPublicReviewsAction } from "@/app/actions/feedback";
import FractionalRatingStars from "@/components/FractionalRatingStars";

type PublicReview = {
  id: string;
  userName: string;
  userAvatar: string | null;
  rating: number;
  comment: string;
  photoUrl: string | null;
  adminReply: string | null;
  adminReplyAt: Date | null;
  createdAt: Date;
};

export default function LandingReviewsSection() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [summary, setSummary] = useState({ totalCount: 0, avgRating: 5.0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadReviews() {
      const res = await getPublicReviewsAction();
      if (res.ok && res.reviews) {
        setReviews(res.reviews);
        setSummary(res.summary);
      }
      setIsLoading(false);
    }
    loadReviews();
  }, []);

  if (isLoading || reviews.length === 0) {
    return null;
  }

  const filteredReviews = selectedStarFilter
    ? reviews.filter((r) => r.rating === selectedStarFilter)
    : reviews;

  // Show top 3-4 reviews directly on landing, rest accessible via modal
  const displayedReviews = reviews.slice(0, 4);

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-12">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Star className="h-3.5 w-3.5 fill-current" /> Відгуки клієнтів
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Що кажуть про Food Balance
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Чесні враження людей, які обрали здорове харчування щодня
          </p>
        </div>

        {/* Rating Score Summary Badge */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm">
          <div className="text-3xl font-black text-amber-500 dark:text-amber-400 leading-none">
            {summary.avgRating.toFixed(1)}
          </div>
          <div>
            <FractionalRatingStars
              rating={summary.avgRating}
              sizeClass="h-4 w-4"
              starSizePx={16}
            />
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {summary.totalCount} {summary.totalCount === 1 ? "відгук" : summary.totalCount < 5 ? "відгуки" : "відгуків"}
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Reviews */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {displayedReviews.map((review) => (
          <div
            key={review.id}
            className="flex flex-col justify-between rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition duration-200"
          >
            <div>
              {/* Header: User & Rating */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-base shadow-xs">
                    {review.userAvatar ? (
                      <img
                        src={review.userAvatar}
                        alt={review.userName}
                        className="h-full w-full object-cover rounded-2xl"
                      />
                    ) : (
                      review.userName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">
                      {review.userName}
                    </h4>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {new Date(review.createdAt).toLocaleDateString("uk-UA", {
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                  </div>
                </div>

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
              </div>

              {/* Review Text */}
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {review.comment}
              </p>

              {/* Attached Photo */}
              {review.photoUrl && (
                <div className="mt-3.5">
                  <button
                    type="button"
                    onClick={() => setPreviewPhotoUrl(review.photoUrl)}
                    className="relative group block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 focus:outline-hidden cursor-pointer"
                  >
                    <img
                      src={review.photoUrl}
                      alt="Фото до відгуку"
                      className="h-36 w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                      🔍 Збільшити фото
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Admin Reply */}
            {review.adminReply && (
              <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
                <div className="rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Відповідь команди FoodBalance
                  </div>
                  <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90 leading-relaxed">
                    {review.adminReply}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Button to view all reviews if more than 4 */}
      {reviews.length > 4 && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm shadow-xs transition cursor-pointer"
          >
            <span>Переглянути всі відгуки ({reviews.length})</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Full Reviews Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Усі відгуки клієнтів ({reviews.length})
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Середня оцінка {summary.avgRating.toFixed(1)} з 5.0
                  </p>
                  <FractionalRatingStars
                    rating={summary.avgRating}
                    sizeClass="h-3.5 w-3.5"
                    starSizePx={14}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Rating Filter Pills */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 dark:border-slate-800 overflow-x-auto bg-slate-50/50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setSelectedStarFilter(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedStarFilter === null
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                Усі ({reviews.length})
              </button>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviews.filter((r) => r.rating === star).length;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSelectedStarFilter(star)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedStarFilter === star
                        ? "bg-amber-500 text-white"
                        : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span>{star} ★</span>
                    <span className="text-[11px] opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {filteredReviews.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  Немає відгуків з вибраною оцінкою.
                </div>
              ) : (
                filteredReviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm">
                          {review.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {review.userName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(review.createdAt).toLocaleDateString("uk-UA", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${
                              s <= review.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-300 dark:text-slate-600"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {review.comment}
                    </p>

                    {review.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewPhotoUrl(review.photoUrl)}
                        className="block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        <img
                          src={review.photoUrl}
                          alt="Фото до відгуку"
                          className="h-32 object-cover rounded-xl hover:scale-105 transition"
                        />
                      </button>
                    )}

                    {review.adminReply && (
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Відповідь команди FoodBalance
                        </div>
                        <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90 leading-relaxed">
                          {review.adminReply}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Zoom Lightbox */}
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
    </section>
  );
}
