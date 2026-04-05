"use client";

import { useRouter } from "next/navigation";
import { useOrderStore } from "@/lib/orderStore";

export default function SushkaPreview() {
  const router = useRouter();
  const selectedDates = useOrderStore((s) => s.selectedDates);
  const setStep = useOrderStore((s) => s.setStep);

  const dayCount = selectedDates.length;

  return (
    <>
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-center text-base leading-relaxed text-gray-700">
          Тариф <span className="font-semibold text-gray-900">Сушка</span> має фіксоване меню. Обрано днів:{" "}
          <span className="font-semibold text-gray-900">{dayCount}</span>.
        </p>
        <p className="mt-4 text-center text-sm text-gray-500">
          Страви підбираються автоматично за обраними днями доставки. Перейдіть до оформлення, щоб вказати адресу
          та контакти.
        </p>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
          >
            Назад
          </button>
          <button
            type="button"
            disabled={dayCount === 0}
            onClick={() => {
              if (dayCount === 0) return;
              router.push("/checkout");
            }}
            className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
              dayCount > 0
                ? "bg-gray-900 text-white hover:bg-blue-600"
                : "cursor-not-allowed bg-gray-200 text-gray-400"
            }`}
          >
            Перейти до оформлення
          </button>
        </div>
      </div>
    </>
  );
}
