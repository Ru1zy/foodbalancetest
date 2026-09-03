"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application runtime error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12 text-center sm:px-6 lg:px-8">
      <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-8 shadow-xl dark:border-red-900/30 dark:bg-slate-900 sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <AlertTriangle className="h-8 w-8 animate-bounce" />
        </div>

        <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Щось пішло не так
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Виникла неочікувана помилка під час обробки вашого запиту. Ми вже зафіксували проблему.
        </p>

        {error.digest && (
          <p className="mt-2 text-[11px] font-mono text-slate-400 dark:text-slate-500">
            Код помилки: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 hover:shadow-emerald-600/30 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            Спробувати знову
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-6 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 active:scale-95"
          >
            <Home className="h-4 w-4" />
            На головну
          </Link>
        </div>
      </div>
    </div>
  );
}
