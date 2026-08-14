"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  calculateSubscriptionPrice, 
  getDiscountForPackage
} from "@/lib/subscription-logic";
import { createSubscriptionPurchaseAction } from "@/app/actions/subscription";
import { uploadReceiptAction } from "@/app/actions/upload-receipt";

type Pkg = {
  id: string;
  name: string;
  basePrice: number;
};

type Props = {
  pkg: Pkg;
  isNewClient?: boolean;
};

export default function SubscriptionOptions({ pkg, isNewClient = true }: Props) {
  const router = useRouter();
  const [days, setDays] = useState<number>(14);
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "cash">("bank_transfer");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validate day input boundaries
  const handleDaysChange = (newDays: number) => {
    if (newDays < 2) newDays = 2;
    if (newDays > 30) newDays = 30; // maximum 30 days
    setDays(newDays);
  };

  const handlePurchase = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    if (paymentMethod === "bank_transfer" && !file) {
      setError("Будь ласка, завантажте скріншот квитанції про оплату.");
      setIsProcessing(false);
      return;
    }

    try {
      let receiptUrl: string | undefined = undefined;

      if (paymentMethod === "bank_transfer" && file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await uploadReceiptAction(formData);
        
        if (!uploadRes.ok) {
          throw new Error(uploadRes.error || "Не вдалося завантажити квитанцію");
        }
        receiptUrl = uploadRes.url;
      }

      const result = await createSubscriptionPurchaseAction(
        pkg.name,
        pkg.basePrice,
        days,
        paymentMethod,
        receiptUrl
      );

      if (!result.ok) {
        throw new Error(result.error || "Помилка при купівлі абонемента");
      }

      setSuccess(`Успішно оформлено покупку на ${days} днів! Дні зараховано на ваш баланс. Адміністратор перевірить вашу оплату найближчим часом.`);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сталася помилка");
    } finally {
      setIsProcessing(false);
      router.refresh();
    }
  };

  const { totalOriginal, totalDiscounted, pricePerDay } = calculateSubscriptionPrice(
    pkg.basePrice,
    pkg.id,
    days
  );
  const discountPercent = Math.round(getDiscountForPackage(pkg.id, days) * 100);

  return (
    <div className="mt-8">
      <h3 className="mb-6 text-xl font-bold text-gray-900">Оберіть кількість днів ({pkg.name})</h3>
      
      {/* Discount rules display */}
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">Правила знижок:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>2 дні:</strong> знижка 10-15% (пробний тариф)</li>
          <li><strong>7-13 днів:</strong> знижка 5%</li>
          <li><strong>14-29 днів:</strong> знижка 10%</li>
          <li><strong>30+ днів:</strong> знижка 15% (крім програми Сушка)</li>
        </ul>
      </div>

      {success && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="max-w-md mx-auto relative flex flex-col rounded-3xl border-2 border-emerald-500 bg-white p-6 shadow-sm">
        {discountPercent > 0 && (
          <div className="absolute -right-3 -top-3 rounded-full bg-red-500 px-4 py-1.5 text-sm font-bold text-white shadow-md">
            -{discountPercent}%
          </div>
        )}
        
        <div className="flex items-center justify-between mb-6">
          <span className="text-gray-700 font-bold">Кількість днів:</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDaysChange(days - 1)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold text-xl transition-colors"
            >
              -
            </button>
            <input
              type="number"
              min={2}
              max={90}
              value={days}
              onChange={(e) => handleDaysChange(parseInt(e.target.value) || 2)}
              className="w-16 text-center text-xl font-bold rounded-lg border border-gray-200 py-1"
            />
            <button
              onClick={() => handleDaysChange(days + 1)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-bold text-xl transition-colors"
            >
              +
            </button>
          </div>
        </div>
        
        <div className="mb-2 flex justify-between items-end">
          <span className="text-gray-500">До сплати:</span>
          <div className="text-right">
             <span className="text-2xl font-black text-gray-900">{totalDiscounted} ₴</span>
             {discountPercent > 0 && (
               <span className="ml-2 text-sm text-gray-400 line-through">{totalOriginal} ₴</span>
             )}
          </div>
        </div>

        <div className="mb-8 text-right text-sm font-semibold text-emerald-600">
          Виходить {pricePerDay} ₴ / день
        </div>

        <div className="mb-6 border-t border-gray-100 pt-6">
          <h4 className="mb-4 font-bold text-gray-900">Спосіб оплати:</h4>
          
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="paymentMethod" 
                value="bank_transfer"
                checked={paymentMethod === "bank_transfer"}
                onChange={() => setPaymentMethod("bank_transfer")}
                className="w-4 h-4 text-emerald-600"
              />
              <span className="text-gray-900 font-medium">Переказ на картку</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="paymentMethod" 
                value="cash"
                checked={paymentMethod === "cash"}
                onChange={() => setPaymentMethod("cash")}
                className="w-4 h-4 text-emerald-600"
              />
              <span className="text-gray-900 font-medium">Готівкою кур'єру</span>
            </label>
          </div>

          {paymentMethod === "bank_transfer" && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
              <p className="mb-2 font-semibold">Реквізити для оплати:</p>
              <p className="font-mono text-gray-700 mb-4 bg-white p-2 rounded border">XXXX XXXX XXXX XXXX (ФОП Іванов І.І.)</p>
              
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Завантажте скріншот оплати:
              </label>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={isProcessing}
          onClick={handlePurchase}
          className="w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {isProcessing ? "Обробка..." : "Оформити покупку"}
        </button>
      </div>
    </div>
  );
}

