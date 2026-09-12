"use client";

import { useEffect, useState } from "react";
import { X, Copy, Check, ExternalLink, CreditCard, Loader2, AlertCircle, PlusCircle } from "lucide-react";
import {
  generateOrderPaymentLinkAction,
  getRelatedUnpaidOrdersAction,
} from "@/app/actions/admin-payments";

type RelatedOrder = {
  id: string;
  packageType: string;
  price: number | null;
  deliveryDate: Date | string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  initialAmountUah: number | null;
  packageType: string;
  customerName: string;
  customerPhone: string;
};

export default function GeneratePaymentLinkModal({
  isOpen,
  onClose,
  orderId,
  initialAmountUah,
  packageType,
  customerName,
  customerPhone,
}: Props) {
  const [amount, setAmount] = useState<string>("");
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [relatedOrders, setRelatedOrders] = useState<RelatedOrder[]>([]);
  const [selectedRelatedIds, setSelectedRelatedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize and load related orders on modal open
  useEffect(() => {
    if (!isOpen) {
      setGeneratedLink(null);
      setError(null);
      setCopied(false);
      setSelectedRelatedIds([]);
      setRelatedOrders([]);
      return;
    }

    const basePrice = initialAmountUah && initialAmountUah > 0 ? initialAmountUah : 0;
    setAmount(basePrice > 0 ? String(basePrice) : "");

    async function loadRelated() {
      setLoadingRelated(true);
      try {
        const res = await getRelatedUnpaidOrdersAction(orderId);
        if (res.ok && res.relatedOrders && res.relatedOrders.length > 0) {
          const rawRelated = res.relatedOrders as RelatedOrder[];
          setRelatedOrders(rawRelated);
          
          // By default, select all related unpaid orders from this cart
          const allRelatedIds = rawRelated.map((o) => o.id);
          setSelectedRelatedIds(allRelatedIds);

          // Calculate total sum of current order + related orders
          const relatedSum = rawRelated.reduce((sum, o) => sum + (o.price || 0), 0);
          const totalSuggested = basePrice + relatedSum;
          if (totalSuggested > 0) {
            setAmount(String(totalSuggested));
          }
        }
      } catch (err) {
        console.error("Failed to load related orders:", err);
      } finally {
        setLoadingRelated(false);
      }
    }

    loadRelated();
  }, [isOpen, orderId, initialAmountUah]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const toggleRelatedOrder = (id: string) => {
    const isCurrentlySelected = selectedRelatedIds.includes(id);
    const updated = isCurrentlySelected
      ? selectedRelatedIds.filter((item) => item !== id)
      : [...selectedRelatedIds, id];

    setSelectedRelatedIds(updated);

    // Recalculate suggested sum
    const basePrice = initialAmountUah && initialAmountUah > 0 ? initialAmountUah : 0;
    const selectedOrders = relatedOrders.filter((o) => updated.includes(o.id));
    const newSum = basePrice + selectedOrders.reduce((sum, o) => sum + (o.price || 0), 0);
    if (newSum > 0) {
      setAmount(String(newSum));
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Вкажіть коректну суму більше 0 ₴");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await generateOrderPaymentLinkAction({
        orderId,
        amountUah: parsedAmount,
        includeRelatedOrderIds: selectedRelatedIds,
      });

      if (!res.ok) {
        setError(res.error || "Не вдалося згенерувати посилання");
      } else {
        setGeneratedLink(res.pageUrl);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Помилка сервера");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const input = document.getElementById("generated-link-input") as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Посилання на оплату (Monobank)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Еквайринг Plata by mono
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Client info summary */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Клієнт:</span>
              <span className="font-bold text-slate-900 dark:text-white">{customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Телефон:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{customerPhone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Тариф замовлення:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{packageType}</span>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-3 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!generatedLink ? (
            <form onSubmit={handleGenerate} className="space-y-5">
              {/* Related Orders Selector */}
              {loadingRelated ? (
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  <span>Пошук супутніх неоплачених раціонів...</span>
                </div>
              ) : relatedOrders.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Супутні раціони цього замовника ({relatedOrders.length})
                    </label>
                    <span className="text-[11px] text-emerald-600 font-medium">
                      Об&apos;єднання в один чек
                    </span>
                  </div>

                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {relatedOrders.map((ro) => {
                      const isChecked = selectedRelatedIds.includes(ro.id);
                      return (
                        <label
                          key={ro.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer text-xs ${
                            isChecked
                              ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-white"
                              : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleRelatedOrder(ro.id)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                            />
                            <span className="font-semibold">{ro.packageType}</span>
                          </div>
                          <span className="font-bold">
                            {ro.price ? `${ro.price} ₴` : "Індивідуально"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Усі вибрані раціони будуть автоматично позначені як «Оплачено» після оплати клієнтом.
                  </p>
                </div>
              ) : null}

              {/* Amount input */}
              <div>
                <label
                  htmlFor="payment-amount"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Сума до сплати клієнтом (₴)
                </label>
                <div className="relative">
                  <input
                    id="payment-amount"
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Наприклад: 7470"
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-lg outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    UAH
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Ви можете ввести будь-яку узгоджену фінальну суму з урахуванням калоражу.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Генерація в Monobank...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      <span>Згенерувати посилання</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Success Result */}
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 space-y-1 text-xs">
                <div className="font-bold text-sm flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <Check className="h-4 w-4" />
                  <span>Посилання успішно створено!</span>
                </div>
                <p>
                  Сума інвойсу: <span className="font-black text-sm">{amount} ₴</span>
                  {selectedRelatedIds.length > 0 && ` (включає ${selectedRelatedIds.length + 1} раціонів)`}
                </p>
              </div>

              {/* URL Box */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Платтіжне посилання для відправки клієнту:
                </label>
                <div className="flex gap-2">
                  <input
                    id="generated-link-input"
                    type="text"
                    readOnly
                    value={generatedLink}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
                      copied
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Скопійовано!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Скопіювати</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                💡 <b>Що далі:</b> Скопіюйте посилання та надішліть клієнту в Telegram або месенджер. Клієнт зможе оплатити через Apple Pay, Google Pay або картку. Як тільки платіж пройде, замовлення автоматично перейде в статус <b>«Оплачено»</b>.
              </div>

              {/* Bottom buttons */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                <a
                  href={generatedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                >
                  <span>Відкрити сторінку оплати</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 transition cursor-pointer"
                >
                  Закрити
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
