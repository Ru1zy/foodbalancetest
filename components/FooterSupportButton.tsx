"use client";

import { MessageSquare } from "lucide-react";

export default function FooterSupportButton() {
  const handleOpen = () => {
    window.dispatchEvent(new CustomEvent("open-support-widget"));
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex items-center gap-2 text-sm text-slate-300 dark:text-slate-400 hover:text-emerald-400 dark:hover:text-emerald-400 transition-colors text-left group cursor-pointer"
      title="Відкрити форму зв'язку з підтримкою"
    >
      <MessageSquare className="w-4 h-4 text-emerald-500 shrink-0 group-hover:scale-110 transition-transform" />
      <span>Зв&apos;язатися з нами (підтримка)</span>
    </button>
  );
}
