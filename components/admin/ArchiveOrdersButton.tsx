"use client";

import { useState, useTransition } from "react";
import { archiveOldOrders } from "@/app/actions/admin";

export default function ArchiveOrdersButton() {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleArchive = () => {
    if (!confirm("Архівувати старі замовлення та видалити покинуті кошики?\n\nЦя дія незворотна для видалених замовлень.")) {
      return;
    }

    startTransition(async () => {
      const result = await archiveOldOrders();

      if (result.ok) {
        setFeedback(`✓ Архівовано: ${result.archived}, Видалено сміття: ${result.deleted}`);
        setTimeout(() => {
          setFeedback(null);
        }, 5000);
      } else {
        setFeedback(`❌ ${result.message}`);
        setTimeout(() => {
          setFeedback(null);
        }, 5000);
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleArchive}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>📦</span>
        <span>{isPending ? "Очищення..." : "Очистити стару базу"}</span>
      </button>

      {feedback && (
        <div
          className={`rounded-lg px-4 py-2 text-sm font-medium shadow-md ${
            feedback.startsWith("✓")
              ? "bg-green-100 text-green-800 border border-green-300"
              : "bg-red-100 text-red-800 border border-red-300"
          }`}
        >
          {feedback}
        </div>
      )}
    </div>
  );
}
