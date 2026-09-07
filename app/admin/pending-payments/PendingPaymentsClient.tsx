"use client";

import { useState } from "react";
import {
  confirmPaymentAction,
  rejectPaymentAction,
  confirmOrderPaymentAction,
  rejectOrderPaymentAction,
  resolveRefundWithBalanceAction,
  resolveRefundWithPayoutAction,
  resolveRefundNoPaymentAction,
  resolveSubscriptionRefundWithPayoutAction,
  resolveSubscriptionRefundWithBalanceAction,
  resolveSubscriptionRefundNoPaymentAction,
} from "@/app/actions/admin-payments";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type RefundItem = {
  id: string;
  itemType: "order" | "subscription";
  packageType: string;
  totalPrice: number;
  refundAmount: number;
  paymentMethod: string;
  receiptUrl?: string | null;
  isPaid?: boolean;
  createdAt: Date;
  cancelledAt: Date | null;
  cancelledDaysCount: number;
  totalDaysCount: number;
  fiatCancelledCount: number;
  cancelledDates: Date[];
  cancelReason: string | null;
  isResolved: boolean;
  user: {
    name: string;
    phone: string;
    address: string | null;
  };
};

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
  refunds: RefundItem[];
  activeType: "subscriptions" | "orders" | "refunds";
  activeTab: "pending" | "history";
  pendingPurchasesCount: number;
  pendingOrdersCount: number;
  pendingRefundsCount: number;
}

type RejectTarget = {
  id: string;
  type: "order" | "subscription";
  title: string;
  clientName: string;
  amount: number;
};

export default function PendingPaymentsClient({
  purchases,
  orders,
  refunds,
  activeType,
  activeTab,
  pendingPurchasesCount,
  pendingOrdersCount,
  pendingRefundsCount,
}: PendingPaymentsClientProps) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingTarget, setRejectingTarget] = useState<RejectTarget | null>(null);

  // Handlers for Subscription purchases
  const handleConfirmPurchase = async (id: string) => {
    setProcessingId(id);
    const res = await confirmPaymentAction(id);
    if (!res.ok) {
      alert(res.error || "Помилка при підтвердженні");
    }
    setProcessingId(null);
    router.refresh();
  };

  const handleRejectPurchaseWithOption = async (id: string, moneyReceived: boolean) => {
    setProcessingId(id);
    setRejectingTarget(null);
    const res = await rejectPaymentAction(id, moneyReceived);
    if (!res.ok) {
      alert(res.error || "Помилка при скасуванні");
    }
    setProcessingId(null);
    router.refresh();
  };

  // Handlers for Regular orders
  const handleConfirmOrder = async (id: string) => {
    setProcessingId(id);
    const res = await confirmOrderPaymentAction(id);
    if (!res.ok) {
      alert(res.error || "Помилка при підтвердженні замовлення");
    }
    setProcessingId(null);
    router.refresh();
  };

  const handleRejectOrderWithOption = async (id: string, moneyReceived: boolean) => {
    setProcessingId(id);
    setRejectingTarget(null);
    const res = await rejectOrderPaymentAction(id, moneyReceived);
    if (!res.ok) {
      alert(res.error || "Помилка при відхиленні замовлення");
    }
    setProcessingId(null);
    router.refresh();
  };

  // Handlers for Refunds (Instant 1-click execution without blocking confirms)
  const handleResolveRefundWithBalance = async (refund: RefundItem) => {
    setProcessingId(refund.id);
    const res =
      refund.itemType === "subscription"
        ? await resolveSubscriptionRefundWithBalanceAction(refund.id)
        : await resolveRefundWithBalanceAction(refund.id, refund.fiatCancelledCount);
    if (!res.ok) alert(res.error || "Помилка при нарахуванні днів на баланс");
    setProcessingId(null);
    router.refresh();
  };

  const handleResolveRefundWithPayout = async (refund: RefundItem) => {
    setProcessingId(refund.id);
    const res =
      refund.itemType === "subscription"
        ? await resolveSubscriptionRefundWithPayoutAction(refund.id)
        : await resolveRefundWithPayoutAction(refund.id);

    if (!res.ok) {
      alert(res.error || "Помилка при збереженні статусу");
    }
    setProcessingId(null);
    router.refresh();
  };

  const handleResolveRefundNoPayment = async (refund: RefundItem) => {
    setProcessingId(refund.id);
    const res =
      refund.itemType === "subscription"
        ? await resolveSubscriptionRefundNoPaymentAction(refund.id)
        : await resolveRefundNoPaymentAction(refund.id);

    if (!res.ok) {
      alert(res.error || "Помилка при збереженні статусу");
    }
    setProcessingId(null);
    router.refresh();
  };

  const isHistory = activeTab === "history";

  return (
    <div className="space-y-6">
      {/* 1. Main Category Tabs: Subscriptions vs Orders vs Refunds */}
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

        <Link
          href={`/admin/pending-payments?type=refunds&tab=${activeTab}`}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeType === "refunds"
              ? "bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <span>💸 До повернення (Refunds)</span>
          {pendingRefundsCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-rose-600 text-white animate-pulse">
              {pendingRefundsCount}
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
              ? activeType === "refunds"
                ? "border-rose-600 text-rose-600 dark:text-rose-400 font-bold"
                : "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
              : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600"
          }`}
        >
          {activeType === "refunds" ? "Очікують вирішення" : "Очікують підтвердження"}
        </Link>
        <Link
          href={`/admin/pending-payments?type=${activeType}&tab=history`}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            isHistory
              ? activeType === "refunds"
                ? "border-rose-600 text-rose-600 dark:text-rose-400 font-bold"
                : "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
              : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:border-slate-600"
          }`}
        >
          {activeType === "refunds" ? "Історія повернень" : "Історія оплат"}
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
                          onClick={() =>
                            setRejectingTarget({
                              id: purchase.id,
                              type: "subscription",
                              title: `Абонемент ${purchase.packageId}`,
                              clientName: purchase.user?.name || "Клієнт",
                              amount: purchase.finalPrice,
                            })
                          }
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
                          onClick={() =>
                            setRejectingTarget({
                              id: order.id,
                              type: "order",
                              title: `Раціон ${order.packageType}`,
                              clientName: order.user?.name || "Клієнт",
                              amount: order.price || 0,
                            })
                          }
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

      {/* 4. Content Section: Refunds */}
      {activeType === "refunds" && (
        <>
          {refunds.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center text-gray-500 dark:text-slate-400">
              {isHistory
                ? "Історія повернень порожня."
                : "🎉 Немає замовлень, що потребують повернення коштів або компенсації!"}
            </div>
          ) : (
            <div className="grid gap-6">
              {refunds.map((refund) => (
                <div
                  key={`${refund.itemType}-${refund.id}`}
                  className="rounded-2xl border border-rose-200/80 dark:border-rose-900/50 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col md:flex-row gap-6"
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                            refund.itemType === "subscription"
                              ? "bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                              : "bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                          }`}
                        >
                          {refund.itemType === "subscription" ? "🎫 Абонемент" : "📦 Раціон"}
                        </span>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                          {refund.user?.name || "Клієнт"}
                        </h3>
                        <a
                          href={`tel:${refund.user?.phone}`}
                          className="text-sm font-semibold text-blue-600 hover:underline"
                        >
                          {refund.user?.phone}
                        </a>
                      </div>
                      <span className="rounded-full bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 px-3 py-1 text-xs font-bold">
                        {refund.isResolved
                          ? "✓ Врегульовано"
                          : refund.itemType === "subscription"
                          ? "⚠️ Скасовано (потребує дії)"
                          : `Скасовано: ${refund.cancelledDaysCount} з ${refund.totalDaysCount} дн.`}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 dark:text-slate-300 space-y-1">
                      <p>
                        <strong>Пакет:</strong> {refund.packageType}
                      </p>
                      {refund.user?.address && (
                        <p>
                          <strong>Адреса:</strong> {refund.user.address}
                        </p>
                      )}
                      <p>
                        <strong>Метод оплати:</strong>{" "}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {refund.paymentMethod === "plata" || refund.paymentMethod === "monobank"
                            ? "💳 Онлайн Monobank Plata"
                            : refund.paymentMethod === "bank_transfer"
                            ? "🏦 Переказ IBAN"
                            : refund.paymentMethod}
                        </span>
                      </p>

                      {refund.receiptUrl && (
                        <div className="pt-1">
                          <a
                            href={refund.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60 transition"
                          >
                            <span>📎</span>
                            <span>Переглянути наданий чек / квитанцію ↗</span>
                          </a>
                        </div>
                      )}

                      {refund.cancelledDates && refund.cancelledDates.length > 0 && (
                        <p>
                          <strong>Скасовані дати:</strong>{" "}
                          {refund.cancelledDates
                            .map((d) =>
                              new Intl.DateTimeFormat("uk-UA", {
                                day: "2-digit",
                                month: "2-digit",
                              }).format(new Date(d))
                            )
                            .join(", ")}
                        </p>
                      )}
                      {refund.cancelledAt && (
                        <p className="text-xs text-slate-400">
                          Дата скасування:{" "}
                          {new Intl.DateTimeFormat("uk-UA", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(refund.cancelledAt))}
                        </p>
                      )}
                      {refund.cancelReason && (
                        <p className="text-xs italic text-slate-500">
                          Причина / статус: {refund.cancelReason}
                        </p>
                      )}
                    </div>

                    <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-baseline gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        До повернення / компенсації:
                      </span>
                      <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                        {refund.refundAmount} ₴
                      </span>
                      <span className="text-xs text-slate-400">
                        (з початкової суми {refund.totalPrice} ₴)
                      </span>
                    </div>
                  </div>

                  {/* Actions for Refund */}
                  <div className="flex md:flex-col justify-end md:justify-center gap-2 border-t md:border-t-0 md:border-l border-gray-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6 min-w-[200px]">
                    {!refund.isResolved ? (
                      <>
                        <button
                          onClick={() => handleResolveRefundWithBalance(refund)}
                          disabled={processingId === refund.id}
                          className="flex-1 md:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                          title="Нарахувати дні клієнту на баланс у CRM замість повернення коштів"
                        >
                          <span>{processingId === refund.id ? "⏳" : "🟢"}</span>
                          <span>
                            Нарахувати баланс (+
                            {refund.itemType === "subscription"
                              ? refund.totalDaysCount
                              : refund.fiatCancelledCount}
                            д)
                          </span>
                        </button>

                        <button
                          onClick={() => handleResolveRefundWithPayout(refund)}
                          disabled={processingId === refund.id}
                          className="flex-1 md:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50"
                          title="Позначити, що кошти вже повернуто через кабінет банку або за реквізитами"
                        >
                          <span>{processingId === refund.id ? "⏳" : "⚪"}</span>
                          <span>Повернено вручну</span>
                        </button>

                        <button
                          onClick={() => handleResolveRefundNoPayment(refund)}
                          disabled={processingId === refund.id}
                          className="flex-1 md:flex-none flex items-center justify-center gap-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/70 px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 transition cursor-pointer disabled:opacity-50"
                          title="Клієнт насправді не платив у банк або чек фейковий — закрити без повернення"
                        >
                          <span>{processingId === refund.id ? "⏳" : "❌"}</span>
                          <span>Оплати не було</span>
                        </button>
                      </>
                    ) : (
                      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3 py-2 rounded-xl text-center">
                        {refund.cancelReason?.includes("BALANCE_CREDITED")
                          ? "✓ Нараховано на баланс в CRM"
                          : refund.cancelReason?.includes("NO_PAYMENT")
                          ? "✓ Оплати не було (закрито)"
                          : "✓ Кошти повернуто вручну"}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Rejection Modal with Money Received Confirmation */}
      {rejectingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-white">
                Скасування: {rejectingTarget.type === "subscription" ? "Абонемент" : "Раціон"}
              </h3>
            </div>
            <p className="text-sm text-slate-300 mb-1">
              <strong>Клієнт:</strong> {rejectingTarget.clientName}
            </p>
            <p className="text-sm text-slate-300 mb-3">
              <strong>Сума:</strong> {rejectingTarget.amount} ₴
            </p>

            <div className="rounded-xl bg-slate-800/80 border border-slate-700/60 p-3.5 my-3 text-xs text-slate-300 space-y-1.5">
              <p className="font-semibold text-white">
                Чи надійшли фактично гроші від клієнта на розрахунковий рахунок?
              </p>
              <p className="text-slate-400">
                • <strong>Ні</strong> (клієнт не платив / фейковий чек) — замовлення скасується без створення повернення.
              </p>
              <p className="text-slate-400">
                • <strong>Так</strong> (гроші вже в банку) — автоматично додасться у вкладку <strong>«💸 До повернення»</strong>, щоб ви не забули повернути кошти або нарахувати дні.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  if (rejectingTarget.type === "subscription") {
                    handleRejectPurchaseWithOption(rejectingTarget.id, false);
                  } else {
                    handleRejectOrderWithOption(rejectingTarget.id, false);
                  }
                }}
                disabled={Boolean(processingId)}
                className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 py-2.5 text-xs font-bold text-slate-200 transition cursor-pointer"
              >
                ❌ Ні, оплати не було (скасувати без виплати)
              </button>

              <button
                onClick={() => {
                  if (rejectingTarget.type === "subscription") {
                    handleRejectPurchaseWithOption(rejectingTarget.id, true);
                  } else {
                    handleRejectOrderWithOption(rejectingTarget.id, true);
                  }
                }}
                disabled={Boolean(processingId)}
                className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              >
                💸 Так, гроші отримано (потрібне повернення)
              </button>

              <button
                onClick={() => setRejectingTarget(null)}
                className="w-full text-center py-1.5 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer mt-1"
              >
                Закрити / Не скасовувати
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
