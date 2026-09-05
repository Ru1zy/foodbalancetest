"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  calculateSubscriptionPrice, 
  getDiscountForPackage
} from "@/lib/subscription-logic";
import { createSubscriptionPurchaseAction } from "@/app/actions/subscription";
import { uploadReceiptAction } from "@/app/actions/upload-receipt";
import { SITE_CONFIG } from "@/lib/site-config";
import type { SubscriptionPurchase } from "@prisma/client";

type Pkg = {
  id: string;
  name: string;
  basePrice: number;
};

export type PurchaseSuccessData = {
  id: string;
  packageId: string;
  days: number;
  finalPrice: number;
  status: string;
  createdAt: Date;
};

type Props = {
  pkg: Pkg;
  isNewClient?: boolean;
  onPurchaseSuccess?: (purchase: PurchaseSuccessData, days: number, packageId: string) => void;
  ibanDetails?: string;
};

export default function SubscriptionOptions({ pkg, isNewClient: _isNewClient = true, onPurchaseSuccess, ibanDetails }: Props) {
  const router = useRouter();
  const [days, setDays] = useState<number>(14);
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "cash" | "plata">("plata");
  const [file, setFile] = useState<File | null>(null);
  const [sendEmailReceipt, setSendEmailReceipt] = useState(false);
  const [receiptEmail, setReceiptEmail] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validate day input boundaries
  const handleDaysChange = (newDays: number) => {
    if (newDays < 2) newDays = 2;
    const maxDays = pkg.name.toLowerCase().includes("sushka") ? 14 : 30;
    if (newDays > maxDays) newDays = maxDays;
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

    if (sendEmailReceipt && !receiptEmail) {
      setError("Будь ласка, введіть email для отримання квитанції.");
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
        days,
        paymentMethod,
        receiptUrl,
        sendEmailReceipt,
        receiptEmail || undefined
      );

      if (!result.ok) {
        throw new Error(result.error || "Помилка при купівлі абонемента");
      }

      if (result.pageUrl) {
        // Monobank payment redirect
        window.location.href = result.pageUrl;
        return;
      }

      setSuccess(
        paymentMethod === "cash" 
          ? `Успішно оформлено покупку на ${days} днів! Оплатіть кур'єру при доставці.`
          : `Успішно оформлено покупку на ${days} днів! Дні зараховано на ваш баланс. Адміністратор перевірить вашу оплату найближчим часом.`
      );
      setFile(null);

      if (result.purchase) {
        onPurchaseSuccess?.(result.purchase, days, pkg.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сталася помилка");
    } finally {
      setIsProcessing(false);
      router.refresh();
    }
  };

  const packageIdentifier = pkg.name || pkg.id;
  const isSushka = packageIdentifier.toLowerCase().includes("sushka") || packageIdentifier.toLowerCase().includes("сушка");

  const { totalOriginal, totalDiscounted, pricePerDay } = calculateSubscriptionPrice(
    pkg.basePrice,
    packageIdentifier,
    days
  );
  const discountPercent = Math.round(getDiscountForPackage(packageIdentifier, days) * 100);

  return (
    <div className="mt-8">
      <h3 className="mb-6 text-xl font-bold text-gray-900 dark:text-slate-100">Оберіть кількість днів ({pkg.name})</h3>
      
      {/* Discount rules display */}
      <div className={`mb-6 rounded-xl border p-4 text-sm ${
        isSushka 
          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200"
          : "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200"
      }`}>
        <p className="font-semibold mb-2">Правила знижок для {pkg.name}:</p>
        <ul className="list-disc list-inside space-y-1">
          {isSushka ? (
            <>
              <li><strong>2 дні:</strong> знижка 10% (пробний тест-драйв)</li>
              <li><strong>7-13 днів:</strong> знижка 5%</li>
              <li><strong>14 днів:</strong> знижка 10% (максимальний рекомендований курс)</li>
            </>
          ) : (
            <>
              <li><strong>2 дні:</strong> знижка 15% (пробний тариф)</li>
              <li><strong>7-13 днів:</strong> знижка 5%</li>
              <li><strong>14-29 днів:</strong> знижка 10%</li>
              <li><strong>30+ днів:</strong> знижка 15%</li>
            </>
          )}
        </ul>
      </div>

      {success && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="max-w-md mx-auto relative flex flex-col rounded-xl border-2 border-emerald-500 dark:border-emerald-400 bg-white dark:bg-slate-900 p-6 shadow-sm">
        {discountPercent > 0 && (
          <div className="absolute -right-3 -top-3 rounded-full bg-red-500 px-4 py-1.5 text-sm font-bold text-white shadow-md">
            -{discountPercent}%
          </div>
        )}
        
        <div className="flex items-center justify-between mb-6">
          <span className="text-gray-700 dark:text-slate-300 font-bold">Кількість днів:</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDaysChange(days - 1)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:bg-slate-700 font-bold text-xl transition-colors"
            >
              -
            </button>
            <input
              type="number"
              min={2}
              max={pkg.name.toLowerCase().includes("sushka") ? 14 : 30}
              value={days}
              onChange={(e) => handleDaysChange(parseInt(e.target.value) || 2)}
              className="w-16 text-center text-xl font-bold rounded-lg border border-gray-200 dark:border-slate-700 py-1 bg-transparent text-gray-900 dark:text-slate-100"
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
          <span className="text-gray-500 dark:text-slate-400">До сплати:</span>
          <div className="text-right">
             <span className="text-2xl font-black text-gray-900 dark:text-slate-100">{totalDiscounted} ₴</span>
             {discountPercent > 0 && (
               <span className="ml-2 text-sm text-gray-400 line-through">{totalOriginal} ₴</span>
             )}
          </div>
        </div>

        <div className="mb-8 text-right text-sm font-semibold text-emerald-600">
          Виходить {pricePerDay} ₴ / день
        </div>

        <div className="mb-6 border-t border-gray-100 dark:border-slate-800 pt-6">
          <h4 className="mb-4 font-bold text-gray-900 dark:text-slate-100">Спосіб оплати:</h4>
          
          <div className="flex flex-col gap-3 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="paymentMethod" 
                value="plata"
                checked={paymentMethod === "plata"}
                onChange={() => setPaymentMethod("plata")}
                className="w-4 h-4 text-emerald-600"
              />
              <div className="flex items-center text-gray-900 dark:text-slate-100 font-medium">
                <img src="/images/mono/plata_light_bg.svg" alt="Plata by mono" className="h-5 object-contain block dark:hidden mr-2" />
                <img src="/images/mono/plata_dark_bg.svg" alt="Plata by mono" className="h-5 object-contain hidden dark:block mr-2" />
              </div>
            </label>
            {paymentMethod === "plata" && (
              <p className="ml-6 text-sm text-orange-600 dark:text-orange-500 italic">
                * Платіжні системи можуть стягувати додаткову комісію (1.3%).
              </p>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                name="paymentMethod" 
                value="bank_transfer"
                checked={paymentMethod === "bank_transfer"}
                onChange={() => setPaymentMethod("bank_transfer")}
                className="w-4 h-4 text-emerald-600"
              />
              <span className="text-gray-900 dark:text-slate-100 font-medium">Переказ на розрахунковий рахунок (IBAN)</span>
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
              <span className="text-gray-900 dark:text-slate-100 font-medium">Готівкою кур&apos;єру</span>
            </label>
          </div>

          {paymentMethod === "bank_transfer" && (
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 p-4 text-sm">
              <p className="mb-2 font-semibold">Реквізити для оплати:</p>
              <p className="font-mono text-gray-700 dark:text-slate-300 mb-4 bg-white dark:bg-slate-900 p-2 rounded border">
                {ibanDetails || SITE_CONFIG.ibanDetails}
              </p>
              
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Завантажте скріншот оплати:
              </label>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
            </div>
          )}
          
          <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="flex h-6 items-center">
                <input
                  type="checkbox"
                  checked={sendEmailReceipt}
                  onChange={(e) => setSendEmailReceipt(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-600"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Відправити квитанцію про оплату на Email
                </span>
                <span className="text-sm text-slate-500">
                  Ми надішлемо копію чеку після підтвердження менеджером
                </span>
              </div>
            </label>
            {sendEmailReceipt && (
              <div className="mt-4 pl-8">
                <input
                  type="email"
                  value={receiptEmail}
                  onChange={(e) => setReceiptEmail(e.target.value)}
                  placeholder="Введіть ваш Email..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-emerald-500 dark:border-emerald-400 focus:bg-white dark:bg-slate-900 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
            )}
          </div>
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

