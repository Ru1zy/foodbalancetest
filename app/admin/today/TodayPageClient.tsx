"use client";

import { useState, useTransition, useRef } from "react";
import { updateOrderDeliveryInfo, notifyTodayOrders } from "@/app/actions/today";

type Order = {
  id: string;
  deliveryDate: Date;
  deliveryAddress: string | null;
  packageType: string;
  cutlery: number;
  notes: string | null;
  deliveryTime: string | null;
  price: number | null;
  user: {
    id: string;
    name: string;
    phone: string;
    chatId: string | null;
    address: string | null;
  };
};

type Props = {
  initialOrders: Order[];
  initialDate: string;
};

export default function TodayPageClient({ initialOrders, initialDate }: Props) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [orders, setOrders] = useState(initialOrders);
  const [isPending, startTransition] = useTransition();
  const [notifyMessage, setNotifyMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    startTransition(async () => {
      const response = await fetch(`/api/admin/today-orders?date=${newDate}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders);
      }
    });
  };

  const handleFieldUpdate = (
    orderId: string,
    field: "deliveryTime" | "notes",
    value: string
  ) => {
    // Optimistic update
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, [field]: value } : order
      )
    );

    // Clear existing timer for this field
    const timerKey = `${orderId}-${field}`;
    if (debounceTimers.current[timerKey]) {
      clearTimeout(debounceTimers.current[timerKey]);
    }

    // Set new debounced save
    debounceTimers.current[timerKey] = setTimeout(() => {
      startTransition(async () => {
        const order = orders.find((o) => o.id === orderId);
        if (!order) return;

        await updateOrderDeliveryInfo(
          orderId,
          field === "deliveryTime" ? value : order.deliveryTime,
          field === "notes" ? value : order.notes
        );
      });
    }, 800);
  };

  const handleNotifyAll = () => {
    setNotifyMessage(null);
    startTransition(async () => {
      const result = await notifyTodayOrders(selectedDate);

      if (result.ok) {
        setNotifyMessage({
          type: "success",
          text: `✓ Відправлено ${result.sent} сповіщень. Пропущено: ${result.skipped}`,
        });
      } else {
        setNotifyMessage({
          type: "error",
          text: `✗ ${result.message}`,
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            📅 Доставки на сьогодні
          </h1>
        </div>

        {/* Date Picker and Notify Button */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-6 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2">
              <label htmlFor="date-picker" className="text-sm font-semibold text-slate-700">
                Дата доставки (формат: ДД.МM.РРРР):
              </label>
              <input
                id="date-picker"
                type="text"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                placeholder="19.04.2026"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <button
              onClick={handleNotifyAll}
              disabled={isPending || orders.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isPending ? "⏳" : "📢"}</span>
              <span>{isPending ? "Відправка..." : "Відправити сповіщення (Telegram)"}</span>
            </button>
          </div>

          {notifyMessage && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium shadow-sm ${
                notifyMessage.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {notifyMessage.text}
            </div>
          )}
        </div>

        {/* Orders Table */}
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-12 text-center shadow-xl">
            <p className="text-lg text-slate-600">Немає замовлень на цю дату</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      ПІБ
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Телефон
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Адреса
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Пакет
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Прибори
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Час доставки
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Нотатки
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Ціна
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Telegram
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-blue-50/50 transition">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {order.user.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {order.user.phone}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {order.deliveryAddress || order.user.address || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {order.packageType}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {order.cutlery}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={order.deliveryTime || ""}
                          onChange={(e) =>
                            handleFieldUpdate(order.id, "deliveryTime", e.target.value)
                          }
                          placeholder="10:00 - 11:00"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={order.notes || ""}
                          onChange={(e) =>
                            handleFieldUpdate(order.id, "notes", e.target.value)
                          }
                          placeholder="Нотатки..."
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        {order.price ? `${order.price} ₴` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {order.user.chatId ? (
                          <span className="text-green-600 text-lg">✓</span>
                        ) : (
                          <span className="text-red-600 text-lg">✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800">
          <p className="font-semibold mb-2">ℹ️ Як працює сторінка:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Показує всі оплачені замовлення на обрану дату</li>
            <li>Редагуйте час доставки та нотатки прямо в таблиці (автозбереження)</li>
            <li>Кнопка &quot;Відправити сповіщення&quot; надсилає Telegram повідомлення всім клієнтам з chatId та часом доставки</li>
            <li>Формат повідомлення: ПІБ, час доставки, нотатки (якщо є)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
