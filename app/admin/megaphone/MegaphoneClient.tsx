"use client";

import { useState } from "react";
import { broadcastMessage } from "@/app/actions/admin";

export default function MegaphoneClient() {
  const [htmlContent, setHtmlContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; message?: string } | null>(null);

  const handleSend = async () => {
    if (!(htmlContent || "").trim()) {
      alert("Введіть текст повідомлення");
      return;
    }

    if (!confirm(`Відправити розсилку всім користувачам?\n\nТекст:\n${htmlContent.substring(0, 100)}...`)) {
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const response = await broadcastMessage(htmlContent);
      setResult({ sent: response.sent, message: response.message });

      if (response.ok) {
        setHtmlContent("");
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
      <div className="mb-4">
        <label htmlFor="message" className="block text-sm font-semibold text-gray-900 mb-2">
          Повідомлення (HTML підтримується)
        </label>
        <textarea
          id="message"
          value={htmlContent}
          onChange={(e) => setHtmlContent(e.target.value)}
          disabled={isSending}
          placeholder="Введіть текст повідомлення. Можна використовувати HTML теги: <b>жирний</b>, <i>курсив</i>, <code>код</code>"
          rows={10}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <p className="mt-2 text-xs text-gray-500">
          Символів: {htmlContent.length}
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm font-semibold text-yellow-800">⚠️ Увага!</p>
        <ul className="mt-2 list-disc list-inside text-xs text-yellow-700 space-y-1">
          <li>Повідомлення буде відправлено ВСІМ користувачам з Telegram ID</li>
          <li>Розсилка може зайняти кілька хвилин (50мс затримка між повідомленнями)</li>
          <li>Перевірте текст перед відправкою - скасувати неможливо</li>
        </ul>
      </div>

      {result && (
        <div className={`mb-4 rounded-xl border p-4 ${
          result.message
            ? "border-red-200 bg-red-50"
            : "border-green-200 bg-green-50"
        }`}>
          <p className={`text-sm font-semibold ${
            result.message ? "text-red-800" : "text-green-800"
          }`}>
            {result.message || `✅ Розсилка завершена!`}
          </p>
          <p className={`mt-1 text-xs ${
            result.message ? "text-red-700" : "text-green-700"
          }`}>
            Відправлено: {result.sent} повідомлень
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSend}
        disabled={isSending || !(htmlContent || "").trim()}
        className={`w-full rounded-xl px-6 py-3 text-sm font-semibold transition ${
          isSending || !(htmlContent || "").trim()
            ? "cursor-not-allowed bg-gray-200 text-gray-400"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {isSending ? "Відправка... Це може зайняти кілька хвилин" : "📢 Відправити розсилку"}
      </button>
    </div>
  );
}
