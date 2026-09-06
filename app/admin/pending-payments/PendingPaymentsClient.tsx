"use client";

import { useState } from "react";
import {
  confirmPaymentAction,
  rejectPaymentAction,
  confirmOrderPaymentAction,
  rejectOrderPaymentAction,
} from "@/app/actions/admin-payments";
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

type PendingOrder = {
  id: string;
  packageType: string;
  price: number | null;
  deliveryDate: Date;
  deliveryAddress: string | null;
  paymentMethod: string;
  receiptUrl: string | null;
  createdAt: Date;
  status: string;
  isPaid: boolean;
  user: {
    name: string;
    phone: string;
    address: string | null;
  } | null;
};

interface PendingPaymentsClientProps {
  purchases: Purchase[];
  orders: PendingOrder[];
  activeType: "subscriptions" | "orders";
  activeTab: "pending" | "history";
  pendingPurchasesCount: number;
  pendingOrdersCount: number;
}

export default function PendingPaymentsClient({
  purchases,
  orders,
  activeType,
  activeTab,
  pendingPurchasesCount,
  pendingOrdersCount,
}: PendingPaymentsClientProps) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Handlers for Subscription purchases
  const handleConfirmPurchase = async (id: string) => {
    if (!confirm("Підтвердити отримання оплати за абонемент?")) return;

    setProcessingId(id);
    const res = await confirmPaymentAction(id);
    if (!res.ok) {
      alert(res.error || "Помилка при підтвердженні");
    }
    setProcessingId(null);
    router.refresh();
  };

  const handleRejectPurchase = async (id: string) => {
    if (!confirm("Відхилити оплату? (Авансово нараховані дні будуть зняті з балансу клієнта)")) return;

    setProcessingId(id);
    const res = await rejectPaymentAction(id);
    if (!res.ok) {
      alert(res.error || "Помилка при скасуванні");
    }
    setProcessingId(null);
    router.refresh();
  };

  // Handlers for Regular orders
  const handleConfirmOrder = async (id: string) => {
    if (!confirm("Підтвердити отримання оплати за це замовлення раціону?")) return;

    setProcessingId(id);
    const res = await confirmOrderPaymentAction(id);
    if (!res.ok) {
      alert(res.error || "Помилка при підтвердженні замовлення");
    }
    setProcessingId(null);
    router.refresh();
  };

  const handleRejectOrder = async (id: string) => {
    if (!confirm("Відхилити оплату та скасувати це замовлення?")) return;

    setProcessingId(id);
    const res = await rejectOrderPaymentAction(id);
    if (!res.ok) {
      alert(res.error || "Помилка при відхиленні замовлення");
    }
    setProcessingId(null);
    router.refresh();
  };

  const isHistory = activeTab === "history";

  return (
    <div className="space-y-6">
      {/* 1. Main Category Tabs: Subscriptions vs Orders */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
        <Link
          href={`/admin/pending-payments?type=subscriptions&tab=${activeTab}`}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeType === "subscriptions"
              ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <span>🎫 Абонементи (баланс)</span>
          {pendingPurchasesCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-amber-500 text-white">
              {pendingPurchasesCount}
            </span>
          )}
        </Link>

        <Link
          href={`/admin/pending-payments?type=orders&tab=${activeTab}`}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeType === "orders"
              ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <span>🍱 Окремі раціони (чекаут)</span>
          {pendingOrdersCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-amber-500 text-white">
              {pendingOrdersCount}
            </span>
          )}
        </Link>
      </div>

      {/* 2. Status Tabs: Pending vs History */}
      <div className="flex border-b border-gray-200 dark:border-slate-700">
        <Link
          href={`/admin/pending-payments?type=${activeType}&tab=pending`}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            !isHistory
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
              : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600"
          }`}
        >
          Очікують підтвердження
        </Link>
        <Link
          href={`/admin/pending-payments?type=${activeType}&tab=history`}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            isHistory
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
              : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600"
          }`}
        >
          Історія оплат
        </Link>
      </div>

      {/* 3. Content Section: Subscriptions */}
      {activeType === "subscriptions" && (
        <>
          {purchases.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-gray-500 dark:text-slate-400">
              {isHistory
                ? "Історія оплат абонементів порожня."
                : "Немає заявок на абонементи, що очікують на підтвердження."}
            </div>
          ) : (
            <div className="grid gap-6">
              {purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col md:flex-row gap-6"
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                          {purchase.user?.name || "Клієнт"}
                        </h3>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-semibold">
                          Абонемент
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        {new Date(purchase.createdAt).toLocaleString("uk-UA")}
                      </span>
                    </div>

                    <p className="text-gray-600 dark:text-slate-400 font-mono text-sm">
                      {purchase.user?.phone || "Без телефону"}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm bg-gray-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="block text-gray-500 dark:text-slate-400 text-xs mb-1">
                          Пакет:
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {purchase.packageId} на {purchase.days} днів
                        </span>
                      </div>
                      <div>
                        <span className="block text-gray-500 dark:text-slate-400 text-xs mb-1">
                          До сплати:
                        </span>
                        <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                          {purchase.finalPrice} ₴
                        </span>
                      </div>
                      <div>
                        <span className="block text-gray-500 dark:text-slate-400 text-xs mb-1">
                          Спосіб:
                        </span>
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                          {purchase.paymentMethod === "bank_transfer" ? (
                            <span className="inline-flex rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 border border-emerald-200 dark:border-emerald-800 font-medium">
                              🏦 Переказ (IBAN)
                            </span>
                          ) : isHistory ? (
                            "Готівка"
                          ) : (
                            <span className="inline-flex rounded-md bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                              ГОТІВКА
                            </span>
                          )}
                        </span>
                      </div>

                      {isHistory && purchase.status && (
                        <div className="col-span-2 sm:col-span-3 pt-1 border-t border-slate-200 dark:border-slate-800">
                          <span className="text-gray-500 dark:text-slate-400 text-xs mr-2">
                            Статус:
                          </span>
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${
                              purchase.status === "PAID"
                                ? "bg-green-100 dark:bg-emerald-950/50 text-green-700 dark:text-emerald-300"
                                : purchase.status === "CANCELLED"
                                ? "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300"
                                : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300"
                            }`}
                          >
                            {purchase.status === "PAID"
                              ? "✓ Оплачено"
                              : purchase.status === "CANCELLED"
                              ? "Скасовано"
                              : purchase.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full md:w-64 flex flex-col gap-3 justify-between">
                    {purchase.receiptUrl ? (
                      (() => {
                        const isPdf = purchase.receiptUrl.toLowerCase().includes(".pdf");
                        return (
                          <a
                            href={purchase.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative flex flex-col items-center justify-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 p-2.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all text-center"
                          >
                            <div className="relative h-24 w-full rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                              {isPdf ? (
                                <div className="flex flex-col items-center justify-center gap-1 text-red-600 dark:text-red-400 group-hover:scale-105 transition-transform">
                                  <span className="text-3xl">📄</span>
                                  <span className="text-[11px] font-bold uppercase tracking-wider">PDF Чек</span>
                                </div>
                              ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={purchase.receiptUrl}
                                  alt="Квитанція"
                                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                />
                              )}
                            </div>
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                              <span>{isPdf ? "Відкрити PDF" : "Переглянути квитанцію"}</span>
                              <span>↗</span>
                            </span>
                          </a>
                        );
                      })()
                    ) : (
                      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 py-3 text-center text-xs text-gray-500 dark:text-slate-400 italic">
                        Без квитанції
                      </div>
                    )}

                    {!isHistory && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleRejectPurchase(purchase.id)}
                          disabled={processingId === purchase.id}
                          className="flex-1 rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 cursor-pointer"
                        >
                          Відхилити
                        </button>
                        <button
                          onClick={() => handleConfirmPurchase(purchase.id)}
                          disabled={processingId === purchase.id}
                          className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-2.5 text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
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
        </>
      )}

      {/* 4. Content Section: Regular Orders */}
      {activeType === "orders" && (
        <>
          {orders.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-gray-500 dark:text-slate-400">
              {isHistory
                ? "Історія оплат за окремі раціони порожня."
                : "Немає замовлень за IBAN, що очікують на підтвердження оплати."}
            </div>
          ) : (
            <div className="grid gap-6">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col md:flex-row gap-6"
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                          {order.user?.name || "Клієнт"}
                        </h3>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                          Щоденний раціон
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        {new Date(order.createdAt).toLocaleString("uk-UA")}
                      </span>
                    </div>

                    <p className="text-gray-600 dark:text-slate-400 font-mono text-sm">
                      {order.user?.phone || "Без телефону"}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm bg-gray-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="block text-gray-500 dark:text-slate-400 text-xs mb-1">
                          Пакет / Раціон:
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {order.packageType}
                        </span>
                      </div>

                      <div>
                        <span className="block text-gray-500 dark:text-slate-400 text-xs mb-1">
                          Дата доставки:
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {new Date(order.deliveryDate).toLocaleDateString("uk-UA", {
                            day: "numeric",
                            month: "long",
                          })}
                        </span>
                      </div>

                      <div>
                        <span className="block text-gray-500 dark:text-slate-400 text-xs mb-1">
                          До сплати:
                        </span>
                        <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                          {order.price !== null && order.price > 0 ? `${order.price} ₴` : "0 ₴"}
                        </span>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="block text-gray-500 dark:text-slate-400 text-xs mb-1">
                          Адреса доставки:
                        </span>
                        <span className="text-xs text-slate-700 dark:text-slate-300">
                          {order.deliveryAddress || order.user?.address || "Самовивіз / не вказано"}
                        </span>
                      </div>

                      <div>
                        <span className="block text-gray-500 dark:text-slate-400 text-xs mb-1">
                          Спосіб оплати:
                        </span>
                        <span className="inline-flex rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
                          {order.paymentMethod === "bank_transfer"
                            ? "🏦 Переказ (IBAN)"
                            : order.paymentMethod}
                        </span>
                      </div>

                      {isHistory && (
                        <div className="col-span-2 sm:col-span-3 pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400 text-xs">
                            Статус замовлення:
                          </span>
                          <span
                            className={`inline-flex rounded-md px-2.5 py-0.5 text-xs font-bold ${
                              order.isPaid
                                ? "bg-green-100 dark:bg-emerald-950/50 text-green-700 dark:text-emerald-300"
                                : "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300"
                            }`}
                          >
                            {order.isPaid ? "✓ Оплачено" : order.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full md:w-64 flex flex-col gap-3 justify-between">
                    {order.receiptUrl ? (
                      (() => {
                        const isPdf = order.receiptUrl.toLowerCase().includes(".pdf");
                        return (
                          <a
                            href={order.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative flex flex-col items-center justify-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 p-2.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all text-center"
                          >
                            <div className="relative h-24 w-full rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                              {isPdf ? (
                                <div className="flex flex-col items-center justify-center gap-1 text-red-600 dark:text-red-400 group-hover:scale-105 transition-transform">
                                  <span className="text-3xl">📄</span>
                                  <span className="text-[11px] font-bold uppercase tracking-wider">PDF Чек</span>
                                </div>
                              ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={order.receiptUrl}
                                  alt="Квитанція"
                                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                />
                              )}
                            </div>
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                              <span>{isPdf ? "Відкрити PDF" : "Переглянути чек"}</span>
                              <span>↗</span>
                            </span>
                          </a>
                        );
                      })()
                    ) : (
                      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 py-3 text-center text-xs text-gray-500 dark:text-slate-400 italic">
                        Без квитанції
                      </div>
                    )}

                    {!isHistory && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleRejectOrder(order.id)}
                          disabled={processingId === order.id}
                          className="flex-1 rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 cursor-pointer"
                        >
                          Скасувати
                        </button>
                        <button
                          onClick={() => handleConfirmOrder(order.id)}
                          disabled={processingId === order.id}
                          className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-2.5 text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                          {processingId === order.id ? "..." : "Підтвердити"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
