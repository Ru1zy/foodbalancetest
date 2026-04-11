"use client";

import { useState, useTransition } from "react";
import { broadcastMessage } from "@/app/actions/admin";

export default function BroadcastPage() {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ sent: number; message?: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      alert("Введіть текст повідомлення");
      return;
    }

    if (!confirm(`Відправити повідомлення всім користувачам?\n\n${message}`)) {
      return;
    }

    startTransition(async () => {
      const response = await broadcastMessage(message);
      if (response.ok) {
        setResult({ sent: response.sent });
        setMessage("");
        alert(`Успішно відправлено ${response.sent} повідомлень!`);
      } else {
        setResult({ sent: 0, message: response.message });
        alert(`Помилка: ${response.message}`);
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Розсилка (Мегафон)</h1>
          <p className="mt-2 text-sm text-gray-600">
            Надішліть повідомлення всім користувачам через Telegram
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="message" className="block text-sm font-semibold text-gray-900">
                Текст повідомлення (HTML підтримується)
              </label>
              <textarea
                id="message"
                name="message"
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isPending}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Введіть текст повідомлення для розсилки. Можна використовувати HTML теги: <b>жирний</b>, <i>курсив</i>, <code>код</code>"
              />
            </div>

            {result && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${
                result.message
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-700"
              }`}>
                {result.message || `Відправлено ${result.sent} повідомлень`}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-gray-100 pt-6">
              <p className="text-sm text-gray-500">
                Повідомлення буде надіслано всім користувачам з Telegram ID
              </p>
              <button
                type="submit"
                disabled={isPending}
                className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
                  isPending
                    ? "cursor-not-allowed bg-gray-200 text-gray-400"
                    : "bg-purple-600 text-white hover:bg-purple-700"
                }`}
              >
                {isPending ? "Надсилаємо..." : "Надіслати всім"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
