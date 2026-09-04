"use client";

import { useSyncExternalStore } from "react";
import { HelpCircle, X, Lightbulb } from "lucide-react";

export interface HelpItem {
  icon?: string;
  title?: string;
  text: string;
}

interface Props {
  id: string;
  title: string;
  description: string;
  items: HelpItem[];
  tips?: string[];
  className?: string;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("admin-help-banner-toggle", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("admin-help-banner-toggle", callback);
  };
}

export default function AdminHelpBanner({
  id,
  title,
  description,
  items,
  tips = [],
  className = "",
}: Props) {
  const storageKey = `admin_help_banner_${id}_v1`;

  const isOpen = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(storageKey) !== "hidden";
      } catch {
        return true;
      }
    },
    () => true // SSR snapshot defaults to open
  );

  const handleClose = () => {
    try {
      localStorage.setItem(storageKey, "hidden");
      window.dispatchEvent(new Event("admin-help-banner-toggle"));
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleOpen = () => {
    try {
      localStorage.removeItem(storageKey);
      window.dispatchEvent(new Event("admin-help-banner-toggle"));
    } catch {
      // Ignore localStorage errors
    }
  };

  if (!isOpen) {
    return (
      <div className={`mb-6 flex justify-end ${className}`}>
        <button
          onClick={handleOpen}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95"
          title="Відкрити довідку"
        >
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          <span>Довідка по розділу</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`mb-6 rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30 p-5 sm:p-6 shadow-sm transition-all relative ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-blue-100/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {description}
            </p>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Сховати довідку (можна відкрити знову в будь-який момент)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Grid of features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 p-3 shadow-2xs"
          >
            {item.icon ? (
              <span className="text-base shrink-0 select-none mt-0.5">{item.icon}</span>
            ) : (
              <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
            )}
            <div className="text-xs leading-relaxed">
              {item.title && (
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-0.5">
                  {item.title}
                </span>
              )}
              <span className="text-slate-600 dark:text-slate-400">
                {item.text}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Optional Pro-Tips */}
      {tips.length > 0 && (
        <div className="mt-4 pt-3 border-t border-blue-100/60 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 shrink-0">
            <Lightbulb className="w-3.5 h-3.5" /> Корисні поради:
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {tips.map((tip, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                • {tip}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
