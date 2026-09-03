"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global uncaught application error:", error);
  }, [error]);

  return (
    <html lang="uk" className="h-full">
      <body className="flex min-h-full flex-col items-center justify-center bg-slate-950 p-6 text-slate-100 font-sans antialiased">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-950/60 text-red-400">
            <span className="text-3xl">⚠️</span>
          </div>

          <h1 className="mt-6 text-2xl font-black tracking-tight text-white">
            Критична помилка
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Стався системний збій. Ми вже сповіщені про проблему та працюємо над її вирішенням.
          </p>

          {error.digest && (
            <p className="mt-2 text-[11px] font-mono text-slate-500">
              Код: {error.digest}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => reset()}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-700 active:scale-95"
            >
              Перезавантажити додаток
            </button>
            <a
              href="/"
              className="rounded-xl border border-slate-800 bg-slate-800 px-6 py-3 text-sm font-bold text-slate-300 transition hover:bg-slate-700 active:scale-95"
            >
              На головну
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
