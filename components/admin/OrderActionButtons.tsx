"use client";

import { useTransition } from "react";
import { confirmOrderPayment } from "@/app/actions/admin";

type Props = {
  orderId: string;
  isPaid: boolean;
  hasChatId: boolean;
};

export default function OrderActionButtons({ orderId, isPaid, hasChatId }: Props) {
  const [isPending, startTransition] = useTransition();

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

  if (isPaid) {
    return (
      <div className="text-xs text-gray-500">
        Оплату підтверджено
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
