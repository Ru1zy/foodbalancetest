"use client";

import { useState } from "react";
import { Copy, Check, CreditCard, FileText } from "lucide-react";
import { SITE_CONFIG } from "@/lib/site-config";

interface IbanPaymentDetailsProps {
  ibanDetails?: string;
  className?: string;
}

export default function IbanPaymentDetails({
  ibanDetails,
  className = "",
}: IbanPaymentDetailsProps) {
  const isPlaceholder =
    !ibanDetails ||
    ibanDetails.includes("будуть надіслані") ||
    ibanDetails.includes("Telegram") ||
    !ibanDetails.includes("UA");
  const details = isPlaceholder ? SITE_CONFIG.ibanDetails : ibanDetails.trim();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Extract IBAN account number if present (UA + 27 digits)
  const ibanMatch = details.match(/\b(UA\d{27})\b/i);
  const rawIban = ibanMatch ? ibanMatch[1].toUpperCase() : null;

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      console.error("Failed to copy to clipboard:", e);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-emerald-200/90 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 sm:p-5 shadow-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              Оплата за реквізитами <span>💚</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Переказ за номером рахунку (IBAN)
            </p>
          </div>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-700/60">
          IBAN
        </span>
      </div>

      {rawIban && (
        <div className="mb-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-emerald-700 dark:text-emerald-400">
              Номер рахунку IBAN
            </span>
            <span className="text-[10px] text-slate-400">для вставки в банк</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 tracking-wider break-all select-all">
              {rawIban}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(rawIban, "iban")}
              className="self-start sm:self-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              {copiedField === "iban" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Скопійовано!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Копіювати IBAN</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Full formatted requisites block */}
      <div className="relative rounded-xl bg-white/90 dark:bg-slate-900/90 p-3.5 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed mb-3 select-all">
        {details}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/50">
        <button
          type="button"
          onClick={() => copyToClipboard(details, "all")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 text-xs font-medium text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
        >
          {copiedField === "all" ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Всі реквізити скопійовано!
              </span>
            </>
          ) : (
            <>
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Скопіювати всі реквізити</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          💡 У Monobank / Приват24 достатньо вставити IBAN
        </p>
      </div>
    </div>
  );
}
