"use client";

import { useState, useTransition } from "react";
import { exportToKitchenSheet } from "@/app/actions/admin";

export default function KitchenExport() {
  // Initialize to tomorrow's date in DD.MM format
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = String(tomorrow.getDate()).padStart(2, '0');
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const defaultDate = `${day}.${month}`;

  const [targetDate, setTargetDate] = useState(defaultDate);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleExportToSheets = () => {
    setMessage(null);

    startTransition(async () => {
      const result = await exportToKitchenSheet(targetDate);

      if (result.ok) {
        setMessage({
          type: "success",
          text: `✓ Успішно експортовано ${result.exported} замовлень в Google Sheets!`,
        });
      } else {
        setMessage({
          type: "error",
          text: `✗ ${result.message}`,
        });
      }
    });
  };

  const handleExportCSV = () => {
    // Convert DD.MM to YYYY-MM-DD for CSV export
    const [day, month] = targetDate.split('.');
    const year = new Date().getFullYear();
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    window.location.href = `/api/admin/export-kitchen?date=${isoDate}&format=csv`;
  };

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-6 shadow-xl ring-1 ring-slate-200/60">
      <h2 className="mb-4 text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
        📊 Експорт на кухню
      </h2>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <label htmlFor="export-date" className="text-sm font-semibold text-slate-700">
            Дата доставки (формат: ДД.МM):
          </label>
          <input
            id="export-date"
            type="text"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            placeholder="23.02"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
          />
          <p className="text-xs text-slate-500">Приклад: 23.02 (23 лютого)</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>📥</span>
            <span>CSV</span>
          </button>

          <button
            onClick={handleExportToSheets}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{isPending ? "⏳" : "📊"}</span>
            <span>{isPending ? "Експорт..." : "Google Sheets"}</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium shadow-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800">
        <p className="font-semibold mb-2">ℹ️ Як працює експорт в Google Sheets:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Шукає вкладку з назвою дати (наприклад, &quot;23.02&quot;)</li>
          <li>Додає нові рядки в кінець таблиці з даними замовлень</li>
          <li>Експортуються всі замовлення, які ще не були експортовані</li>
          <li>Після експорту замовлення отримують статус &quot;Передано в учёт&quot;</li>
          <li>Повторний експорт не створить дублікатів</li>
        </ul>
      </div>
    </div>
  );
}
