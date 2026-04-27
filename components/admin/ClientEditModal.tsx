"use client";

import { useState, useTransition } from "react";
import { updateClientInfo, unlinkTelegramAccount } from "@/app/actions/clients";

type Client = {
  id: string;
  name: string;
  phone: string;
  chatId: string | null;
  address: string | null;
  notes: string | null;
  defaultPackage: string | null;
};

type Props = {
  client: Client;
  onClose: () => void;
};

export default function ClientEditModal({ client, onClose }: Props) {
  const [address, setAddress] = useState(client.address || "");
  const [notes, setNotes] = useState(client.notes || "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateClientInfo(client.id, { address, notes });

      if (result.ok) {
        setFeedback("✓ Збережено");
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setFeedback(result.message);
      }
    });
  };

  const handleUnlinkTelegram = () => {
    if (!confirm(`Відв'язати Telegram акаунт для ${client.name}?`)) {
      return;
    }

    startTransition(async () => {
      const result = await unlinkTelegramAccount(client.id);

      if (result.ok) {
        setFeedback("✓ Telegram відв'язано");
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setFeedback(result.message);
      }
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-4">
          <h2 className="text-2xl font-bold text-gray-900">Редагувати клієнта</h2>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">Ім&apos;я:</span>
                <div className="font-semibold text-slate-900">{client.name}</div>
              </div>
              <div>
                <span className="text-slate-500">Телефон:</span>
                <div className="font-semibold text-slate-900">{client.phone}</div>
              </div>
              <div>
                <span className="text-slate-500">Тариф за замовчуванням:</span>
                <div className="font-semibold text-slate-900">{client.defaultPackage || "—"}</div>
              </div>
              <div>
                <span className="text-slate-500">Telegram:</span>
                <div className="flex items-center gap-2">
                  {client.chatId ? (
                    <>
                      <span className="font-semibold text-green-600">✓ Підключено</span>
                      <button
                        onClick={handleUnlinkTelegram}
                        disabled={isPending}
                        className="text-xs text-red-600 hover:text-red-700 underline"
                      >
                        Відв&apos;язати
                      </button>
                    </>
                  ) : (
                    <span className="font-semibold text-slate-400">Не підключено</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Адреса доставки
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              rows={2}
              placeholder="Вул. Хрещатик, буд. 1, кв. 10"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Внутрішні нотатки (не видно клієнту)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              rows={3}
              placeholder="Додаткова інформація про клієнта..."
            />
          </div>

          {feedback && (
            <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
              feedback.startsWith("✓")
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {feedback}
            </div>
          )}

          <div className="flex gap-3 border-t border-gray-200 pt-4">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Збереження..." : "Зберегти зміни"}
            </button>
            <button
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Скасувати
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
