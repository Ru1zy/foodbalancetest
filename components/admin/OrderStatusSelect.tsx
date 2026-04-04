"use client";

import { ChangeEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/app/actions/admin";
import { ORDER_STATUS_OPTIONS } from "@/src/lib/order-status";

type OrderStatusSelectProps = {
  currentStatus: string;
  orderId: string;
};

export default function OrderStatusSelect({ currentStatus, orderId }: OrderStatusSelectProps) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedStatus(currentStatus);
  }, [currentStatus]);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const previousStatus = selectedStatus;
    const nextStatus = event.target.value;

    setSelectedStatus(nextStatus);
    setError(null);

    startTransition(async () => {
      const result = await updateOrderStatus(orderId, nextStatus);

      if (!result.ok) {
        setSelectedStatus(previousStatus);
        setError(result.message);
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="min-w-44">
      <select
        value={selectedStatus}
        onChange={handleChange}
        disabled={isPending}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
      >
        {ORDER_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {isPending && <p className="mt-2 text-xs font-medium text-gray-500">Зберігаємо статус...</p>}
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
