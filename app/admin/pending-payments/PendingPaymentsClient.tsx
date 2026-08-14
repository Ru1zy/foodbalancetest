"use client";

import { useState } from "react";
import { confirmPaymentAction, rejectPaymentAction } from "@/app/actions/admin-payments";
import { useRouter } from "next/navigation";

type Purchase = {
  id: string;
  packageId: string;
  days: number;
  finalPrice: number;
  paymentMethod: string;
  receiptUrl: string | null;
  createdAt: Date;
  user: {
    name: string;
    phone: string;
  };
};

export default function PendingPaymentsClient({ purchases }: { purchases: Purchase[] }) {
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

  if (purchases.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
        Немає заявок, що очікують на підтвердження.
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {purchases.map((purchase) => (
        <div key={purchase.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{purchase.user.name}</h3>
              <span className="text-sm text-gray-500">
                {new Date(purchase.createdAt).toLocaleString("uk-UA")}
              </span>
            </div>
            
            <p className="text-gray-600 font-mono text-sm">{purchase.user.phone}</p>
            
            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg">
              <div>
                <span className="block text-gray-500 mb-1">Пакет:</span>
                <span className="font-semibold">{purchase.packageId} на {purchase.days} днів</span>
              </div>
              <div>
                <span className="block text-gray-500 mb-1">До сплати:</span>
                <span className="font-bold text-lg text-emerald-600">{purchase.finalPrice} ₴</span>
              </div>
              <div>
                <span className="block text-gray-500 mb-1">Спосіб:</span>
                <span className="font-semibold capitalize">
                  {purchase.paymentMethod === 'bank_transfer' ? 'Переказ на картку' : 'Готівка'}
                </span>
              </div>
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
              <div className="rounded-lg border border-gray-200 bg-gray-50 py-2 text-center text-sm text-gray-500 italic">
                Квитанція відсутня
              </div>
            )}

            <button
              disabled={processingId === purchase.id}
              onClick={() => handleConfirm(purchase.id)}
              className="w-full rounded-lg bg-emerald-600 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {processingId === purchase.id ? "..." : "Підтвердити оплату"}
            </button>
            <button
              disabled={processingId === purchase.id}
              onClick={() => handleReject(purchase.id)}
              className="w-full rounded-lg border border-red-200 bg-white py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Відхилити
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
