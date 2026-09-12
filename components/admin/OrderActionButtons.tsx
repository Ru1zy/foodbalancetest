"use client";

import { useState, useTransition } from "react";
import { confirmOrderPayment, notifyDeliveryTime } from "@/app/actions/admin";
import GeneratePaymentLinkModal from "./GeneratePaymentLinkModal";

type Props = {
  orderId: string;
  isPaid: boolean;
  hasChatId: boolean;
  orderPrice?: number | null;
  packageType?: string;
  customerName?: string;
  customerPhone?: string;
};

export default function OrderActionButtons({
  orderId,
  isPaid,
  hasChatId,
  orderPrice,
  packageType,
  customerName,
  customerPhone,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [isSendingTime, setIsSendingTime] = useState(false);
  const [timeWindow, setTimeWindow] = useState("");
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

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
    if (!(timeWindow || "").trim()) {
      alert("Вкажіть час доставки");
      return;
    }

    setIsSendingTime(true);
    try {
      const result = await notifyDeliveryTime(orderId, timeWindow);
      if (result.ok) {
        setTimeWindow("");
        alert("Повідомлення надіслано!");
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
        <div className="text-xs text-gray-500 dark:text-slate-400">
          Оплату підтверджено
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 w-full min-w-[170px]">
        <button
          type="button"
          onClick={handleConfirmPayment}
          disabled={isPending}
          className={`w-full rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
            isPending
              ? "cursor-not-allowed bg-gray-200 dark:bg-slate-700 text-gray-400"
              : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
          }`}
        >
          {isPending ? "Обробка..." : "✓ Підтвердити"}
        </button>

        <button
          type="button"
          onClick={() => setIsLinkModalOpen(true)}
          className="w-full rounded-xl px-3 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
        >
          <span>💳 Посилання Mono</span>
        </button>
      </div>

      <GeneratePaymentLinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        orderId={orderId}
        initialAmountUah={orderPrice ?? null}
        packageType={packageType || "Раціон"}
        customerName={customerName || "Клієнт"}
        customerPhone={customerPhone || ""}
      />
    </>
  );
}

