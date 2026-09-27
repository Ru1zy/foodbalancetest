"use client";

import { MessageSquare } from "lucide-react";

export default function HeaderSupportButton() {
  const handleOpen = () => {
    window.dispatchEvent(new CustomEvent("open-support-widget"));
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="inline-flex h-8 w-8 sm:h-9 sm:w-auto items-center justify-center sm:gap-1.5 sm:px-2.5 md:px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all text-xs font-semibold shadow-2xs active:scale-95 cursor-pointer shrink-0"
      title="Зв'язатися з нами / Підтримка"
      aria-label="Підтримка"
    >
      <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
      <span className="hidden sm:inline font-bold">Підтримка</span>
    </button>
  );
}
