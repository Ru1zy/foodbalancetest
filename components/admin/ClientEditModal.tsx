"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateClientInfo, unlinkTelegramAccount } from "@/app/actions/clients";
import { updateUserBalance } from "@/app/actions/admin-balances";

type Client = {
  id: string;
  name: string;
  phone: string;
  chatId: string | null;
  address: string | null;
  notes: string | null;
  defaultPackage: string | null;
  balances: {
    packageId: string;
    totalDays: number;
    usedDays: number;
  }[];
};

type Props = {
  client: Client;
  onClose: () => void;
};

export default function ClientEditModal({ client, onClose }: Props) {
  const router = useRouter();
  const [address, setAddress] = useState(client.address || "");
  const [notes, setNotes] = useState(client.notes || "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [balancePackage, setBalancePackage] = useState("Slim");
  const [balanceDays, setBalanceDays] = useState(14);
  const [localBalances, setLocalBalances] = useState(client.balances);

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateClientInfo(client.id, { address, notes });

      if (result.ok) {
        setFeedback("✓ Збережено");
        router.refresh();
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setFeedback(result.message);
      }
    });
  };

  const handleUpdateBalance = (days: number) => {
    startTransition(async () => {
      const result = await updateUserBalance(client.id, balancePackage, days);
      if (result.ok) {
        setFeedback(`✓ Баланс ${balancePackage} оновлено`);
        
        // Optimistic update
        setLocalBalances(prev => {
          const existing = prev.find(b => b.packageId === balancePackage);
          if (existing) {
            return prev.map(b => 
              b.packageId === balancePackage 
                ? { ...b, totalDays: b.totalDays + days } 
                : b
            );
          } else {
            return [...prev, { packageId: balancePackage, totalDays: Math.max(0, days), usedDays: 0 }];
          }
        });

        router.refresh();
      } else {
        setFeedback(result.message || "Помилка");
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

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <h3 className="mb-3 text-sm font-bold text-emerald-900 uppercase tracking-wider">Керування балансом</h3>
            
            {localBalances.length > 0 && (
              <div className="mb-4 space-y-2">
                {localBalances.map((b) => (
                  <div key={b.packageId} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-emerald-200">
                    <span className="font-bold text-slate-700">{b.packageId}</span>
                    <span className="font-black text-emerald-600">
                      Залишилось: {b.totalDays - b.usedDays} днів
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <select
                value={balancePackage}
                onChange={(e) => setBalancePackage(e.target.value)}
                className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
              >
                {["Slim", "Balance", "Active", "Sport", "Sushka S", "Sushka XS", "Indiv"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                type="number"
                value={balanceDays}
                onChange={(e) => setBalanceDays(Number(e.target.value))}
                className="w-20 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                placeholder="Дні"
                min="-100"
                max="100"
              />
              <button
                onClick={() => handleUpdateBalance(balanceDays)}
                disabled={isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Додати дні
              </button>
            </div>
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
