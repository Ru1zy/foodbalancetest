"use client";

import { useState, useTransition } from "react";
import { confirmOrderPayment, notifyDeliveryTime } from "@/app/actions/admin";

type Props = {
  orderId: string;
  isPaid: boolean;
  hasChatId: boolean;
};

export default function OrderActionButtons({ orderId, isPaid, hasChatId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isSendingTime, setIsSendingTime] = useState(false);
  const [timeWindow, setTimeWindow] = useState("");

  const handleConfirmPayment = () => {
    if (!confirm("Підтвердити оплату цього замовлення?")) {
      return;
    }

    startTransition(async () => {
      const result = await confirmOrderPayment(orderId);
      if (!result.ok) {
        alert(`Помилка: ${result.message}`);
      }
    });
  };

  const handleNotifyTime = async () => {
    if (!timeWindow.trim()) {
      alert("Вкажіть час доставки");
      return;
    }

    setIsSendingTime(true);
    try {
      const result = await notifyDeliveryTime(orderId, timeWindow);
      if (result.ok) {
        setTimeWindow("");
        alert("Повідомлення відправлено!");
      } else {
        alert(`Помилка: ${result.message}`);
      }
    } finally {
      setIsSendingTime(false);
    }
  };

  if (isPaid) {
    return (
      <div className="flex flex-col gap-2 w-full max-w-[200px]">
        <div className="text-xs text-gray-500">
          Оплату підтверджено
        </div>
        {hasChatId && (
          <>
            <input
              type="text"
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value)}
              placeholder="Time (e.g. 19:00-20:00)"
              disabled={isSendingTime}
              className="w-full rounded-lg border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleNotifyTime}
              disabled={isSendingTime}
              className={`w-full rounded-lg px-3 py-1 text-sm font-semibold transition ${
                isSendingTime
                  ? "cursor-not-allowed bg-gray-200 text-gray-400"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isSendingTime ? "..." : "Notify Time"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConfirmPayment}
      disabled={isPending}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        isPending
          ? "cursor-not-allowed bg-gray-200 text-gray-400"
          : "bg-green-600 text-white hover:bg-green-700"
      }`}
    >
      {isPending ? "Обробка..." : "Підтвердити оплату"}
    </button>
  );
}
