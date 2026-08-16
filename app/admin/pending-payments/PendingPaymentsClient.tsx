"use client";

import { useState } from "react";
import { confirmPaymentAction, rejectPaymentAction } from "@/app/actions/admin-payments";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Purchase = {
  id: string;
  packageId: string;
  days: number;
  finalPrice: number;
  paymentMethod: string;
  receiptUrl: string | null;
  createdAt: Date;
  status?: string;
  user: {
    name: string;
    phone: string;
  };
};

export default function PendingPaymentsClient({ purchases, activeTab }: { purchases: Purchase[], activeTab: string }) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleConfirm = async (id: string) => {
    if (!confirm("Підтвердити отримання оплати?")) return;
    
    setProcessingId(id);
    const res = await confirmPaymentAction(id);
    if (!res.ok) {
      alert(res.error || "Помилка");
    }
    setProcessingId(null);
    router.refresh();
  };

  const handleReject = async (id: string) => {
    if (!confirm("Відхилити оплату? (Дні будуть зняті з балансу клієнта)")) return;
    
    setProcessingId(id);
    const res = await rejectPaymentAction(id);
    if (!res.ok) {
      alert(res.error || "Помилка");
    }
    setProcessingId(null);
    router.refresh();
  };

  const isHistory = activeTab === "history";

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700">
        <Link
          href="/admin/pending-payments?tab=pending"
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            !isHistory
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600"
          }`}
        >
          Очікують підтвердження
        </Link>
        <Link
          href="/admin/pending-payments?tab=history"
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            isHistory
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600"
          }`}
        >
          Історія оплат
        </Link>
      </div>

      {purchases.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-gray-500 dark:text-slate-400">
          {isHistory ? "Історія оплат порожня." : "Немає заявок, що очікують на підтвердження."}
        </div>
      ) : (
        <div className="grid gap-6">
          {purchases.map((purchase) => (
            <div key={purchase.id} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">{purchase.user.name}</h3>
                  <span className="text-sm text-gray-500 dark:text-slate-400">
                    {new Date(purchase.createdAt).toLocaleString("uk-UA")}
                  </span>
                </div>
                
                <p className="text-gray-600 dark:text-slate-400 font-mono text-sm">{purchase.user.phone}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-slate-950 p-4 rounded-lg">
                  <div>
                    <span className="block text-gray-500 dark:text-slate-400 mb-1">Пакет:</span>
                    <span className="font-semibold">{purchase.packageId} на {purchase.days} днів</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 dark:text-slate-400 mb-1">До сплати:</span>
                    <span className="font-bold text-lg text-emerald-600">{purchase.finalPrice} ₴</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 dark:text-slate-400 mb-1">Спосіб:</span>
                    <span className="font-semibold capitalize">
                      {purchase.paymentMethod === 'bank_transfer' ? 'Переказ на картку' : (
                        isHistory ? 'Готівка' : (
                          <span className="inline-flex rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                            ГОТІВКА - ПЕРЕВІРИТИ ОПЛАТУ
                          </span>
                        )
                      )}
                    </span>
                  </div>
                  {isHistory && purchase.status && (
                    <div>
                      <span className="block text-gray-500 dark:text-slate-400 mb-1">Статус:</span>
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${
                        purchase.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        purchase.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                      }`}>
                        {purchase.status === 'PAID' ? 'Оплачено' : 
                         purchase.status === 'CANCELLED' ? 'Скасовано' : purchase.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full md:w-64 flex flex-col gap-3">
                {purchase.receiptUrl ? (
                  <a 
                    href={purchase.receiptUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Переглянути квитанцію ↗
                  </a>
                ) : (
                  <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 py-2 text-center text-sm text-gray-500 dark:text-slate-400 italic">
                    Без квитанції
                  </div>
                )}
                
                {!isHistory && (
                  <div className="flex gap-2 mt-auto pt-2">
                    <button
                      onClick={() => handleReject(purchase.id)}
                      disabled={processingId === purchase.id}
                      className="flex-1 rounded-lg border border-red-200 bg-white dark:bg-slate-900 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Відхилити
                    </button>
                    <button
                      onClick={() => handleConfirm(purchase.id)}
                      disabled={processingId === purchase.id}
                      className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                    >
                      {processingId === purchase.id ? "..." : "Підтвердити"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
