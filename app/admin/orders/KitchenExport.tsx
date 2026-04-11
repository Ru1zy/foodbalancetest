"use client";

import { useState } from "react";

export default function KitchenExport() {
  // Initialize to tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(tomorrowStr);

  const handleExport = () => {
    window.location.href = `/api/admin/export-kitchen?date=${selectedDate}`;
  };

  return (
    <div className="mb-6 flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <label htmlFor="export-date" className="text-sm font-medium text-gray-700">
          Дата для експорту:
        </label>
        <input
          id="export-date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <button
        onClick={handleExport}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      >
        📥 Експорт на кухню (CSV)
      </button>
    </div>
  );
}
