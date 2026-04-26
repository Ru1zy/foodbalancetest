"use client";

import Link from "next/link";
import { useOrderStore } from "@/lib/orderStore";

export default function SushkaPreview() {
  const selectedDates = useOrderStore((s) => s.selectedDates);
  const setStep = useOrderStore((s) => s.setStep);

  const dayCount = selectedDates.length;

  return (
    <>
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-base leading-relaxed text-gray-700">
          Тариф <span className="font-semibold text-gray-900">Сушка</span> має фіксоване меню. Обрано днів:{" "}
          <span className="font-semibold text-gray-900">{dayCount}</span>.
        </p>
        <p className="mt-4 text-sm text-gray-500">
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
          {dayCount > 0 ? (
            <Link
              href="/checkout"
              className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              Перейти до оформлення
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-xl bg-gray-200 px-6 py-3 text-sm font-semibold text-gray-400"
            >
              Перейти до оформлення
            </button>
          )}
        </div>
      </div>
    </>
  );
}
