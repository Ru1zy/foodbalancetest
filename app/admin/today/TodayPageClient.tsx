"use client";

import { useState, useTransition, useRef } from "react";
import { updateOrderDeliveryInfo, notifyTodayOrders, exportToKitchenSheet } from "@/app/actions/admin";

type Order = {
  id: string;
  orderDayId: string | null;
  deliveryDate: Date;
  deliveryAddress: string | null;
  packageType: string;
  cutlery: number;
  notes: string | null;
  deliveryTime: string | null;
  deliveryNote: string | null;
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
    // Only fetch if format matches DD.MM
    if (/^\d{1,2}\.\d{1,2}$/.test(newDate)) {
      startTransition(async () => {
        const response = await fetch(`/api/admin/today-orders?date=${newDate}`);
        if (response.ok) {
          const data = await response.json();
          setOrders(data.orders);
        }
      });
    }
  };

  const handleFieldUpdate = (
    orderId: string,
    orderDayId: string | null,
    field: "deliveryTime" | "deliveryNote",
    value: string
  ) => {
    // Optimistic update
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, [field]: value } : order
      )
    );

    // Clear existing timer for this field
    const timerKey = `${orderDayId ?? orderId}-${field}`;
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
          orderDayId,
          field === "deliveryTime" ? value : order.deliveryTime,
          field === "deliveryNote" ? value : order.deliveryNote
        );
      });
    }, 800);
  };

  const handleNotifyAll = () => {
    setNotifyMessage(null);
    startTransition(async () => {
      const result = await notifyTodayOrders(selectedDate);

      if (result.ok) {
        const reasons = result.skippedReasons?.length
          ? ` Причини: ${result.skippedReasons.join("; ")}`
          : "";
        setNotifyMessage({
          type: "success",
          text: `✓ Відправлено ${result.sent} сповіщень. Пропущено: ${result.skipped}.${reasons}`,
        });
      } else {
        setNotifyMessage({
          type: "error",
          text: `✗ ${result.message}`,
        });
      }
    });
  };
const handleExportToKitchen = () => {
  setNotifyMessage(null);
  startTransition(async () => {
    const result = await exportToKitchenSheet(selectedDate);

    if (result.ok) {
      setNotifyMessage({
          type: "success",
          text: `✓ Успішно експортовано ${result.exported} замовлень в Google Sheets!`,
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
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-950 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">
            📅 Доставки на сьогодні
          </h1>
        </div>

        {/* Date Picker and Notify Button */}
        <div className="mb-6 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2">
              <label htmlFor="date-picker" className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                Дата доставки (формат: ДД.МM):
              </label>
              <input
                id="date-picker"
                type="text"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                placeholder="19.04"
                className="rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-slate-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleExportToKitchen}
                disabled={isPending || orders.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isPending ? "⏳" : "🍳"}</span>
                <span>{isPending ? "Експорт..." : "Експорт на кухню"}</span>
              </button>

              <button
                onClick={handleNotifyAll}
                disabled={isPending || orders.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isPending ? "⏳" : "📢"}</span>
                <span>{isPending ? "Відправка..." : "Відправити сповіщення (Telegram)"}</span>
              </button>
            </div>
          </div>

          {notifyMessage && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium shadow-sm ${
                notifyMessage.type === "success"
                  ? "bg-green-50 dark:bg-emerald-950/40 text-green-800 dark:text-emerald-300 border border-green-200 dark:border-emerald-800"
                  : "bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800"
              }`}
            >
              {notifyMessage.text}
            </div>
          )}
        </div>

        {/* Orders Table */}
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 shadow-sm">
            <p className="text-lg text-gray-600 dark:text-slate-400">Немає замовлень на цю дату</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-950">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      ПІБ
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Телефон
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Адреса
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Пакет
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Прибори
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Коментар клієнта
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Час доставки
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Нотатка адміна
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Ціна
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Telegram
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Дії
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {orders.map((order) => (
                    <tr key={order.orderDayId ?? order.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {order.user.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {order.user.phone}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {order.deliveryAddress || order.user.address || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {order.packageType}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {order.cutlery}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {order.notes ? (
                          <div className="max-w-xs text-xs italic text-slate-500">
                            {order.notes}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={order.deliveryTime || ""}
                          onChange={(e) =>
                            handleFieldUpdate(order.id, order.orderDayId, "deliveryTime", e.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-gray-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">Не обрано</option>
                          <optgroup label="Вечір">
                            <option value="17:00-17:30">17:00-17:30</option>
                            <option value="17:30-18:00">17:30-18:00</option>
                            <option value="18:00-18:30">18:00-18:30</option>
                            <option value="18:30-19:00">18:30-19:00</option>
                            <option value="19:00-19:30">19:00-19:30</option>
                            <option value="19:30-20:00">19:30-20:00</option>
                            <option value="20:00-20:30">20:00-20:30</option>
                            <option value="20:30-21:00">20:30-21:00</option>
                            <option value="21:00-21:30">21:00-21:30</option>
                            <option value="21:30-22:00">21:30-22:00</option>
                            <option value="22:00-22:30">22:00-22:30</option>
                            <option value="22:30-23:00">22:30-23:00</option>
                          </optgroup>
                          <optgroup label="Ранок">
                            <option value="06:00-06:30">06:00-06:30</option>
                            <option value="06:30-07:00">06:30-07:00</option>
                            <option value="07:00-07:30">07:00-07:30</option>
                            <option value="07:30-08:00">07:30-08:00</option>
                            <option value="08:00-08:30">08:00-08:30</option>
                            <option value="08:30-09:00">08:30-09:00</option>
                            <option value="09:00-09:30">09:00-09:30</option>
                            <option value="09:30-10:00">09:30-10:00</option>
                            <option value="10:00-10:30">10:00-10:30</option>
                            <option value="10:30-11:00">10:30-11:00</option>
                            <option value="11:00-11:30">11:00-11:30</option>
                            <option value="11:30-12:00">11:30-12:00</option>
                          </optgroup>
                          <optgroup label="День">
                            <option value="12:00-12:30">12:00-12:30</option>
                            <option value="12:30-13:00">12:30-13:00</option>
                            <option value="13:00-13:30">13:00-13:30</option>
                            <option value="13:30-14:00">13:30-14:00</option>
                            <option value="14:00-14:30">14:00-14:30</option>
                            <option value="14:30-15:00">14:30-15:00</option>
                            <option value="15:00-15:30">15:00-15:30</option>
                            <option value="15:30-16:00">15:30-16:00</option>
                            <option value="16:00-16:30">16:00-16:30</option>
                            <option value="16:30-17:00">16:30-17:00</option>
                          </optgroup>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={order.deliveryNote || ""}
                          onChange={(e) =>
                            handleFieldUpdate(order.id, order.orderDayId, "deliveryNote", e.target.value)
                          }
                          placeholder="Нотатка для клієнта..."
                          className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {order.price ? `${order.price} ₴` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {order.user.chatId ? (
                          <span className="text-green-600 text-lg">✓</span>
                        ) : (
                          <span className="text-red-600 text-lg">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {order.orderDayId && (
                          <button
                            onClick={async () => {
                              if (!confirm("Ви впевнені, що хочете скасувати це замовлення? Клієнту буде повернуто 1 день на баланс, а рядок в Google Sheets стане червоним.")) return;
                              try {
                                const { adminCancelOrderDay } = await import('@/app/actions/order-cancel');
                                await adminCancelOrderDay(order.orderDayId!);
                                setOrders(prev => prev.filter(o => o.orderDayId !== order.orderDayId));
                              } catch (err: unknown) {
                                const message = err instanceof Error ? err.message : "Помилка при скасуванні";
                                alert(message);
                              }
                            }}
                            className="inline-flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                            title="Скасувати день"
                          >
                            ❌ Скасувати
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 px-4 py-3 text-xs text-blue-800 dark:text-blue-200">
          <p className="font-semibold mb-2">ℹ️ Як працює сторінка:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Показує всі активні замовлення на обрану дату незалежно від способу оплати</li>
            <li>&quot;Коментар клієнта&quot; - побажання клієнта при оформленні (тільки для перегляду)</li>
            <li>&quot;Нотатка адміна&quot; - ваше повідомлення для клієнта (автозбереження)</li>
            <li>Редагуйте час доставки та нотатку адміна прямо в таблиці</li>
            <li>Кнопка &quot;Відправити сповіщення&quot; надсилає Telegram повідомлення всім клієнтам з chatId та часом доставки</li>
            <li>Формат повідомлення: ПІБ, час доставки, нотатка адміна (якщо є)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
