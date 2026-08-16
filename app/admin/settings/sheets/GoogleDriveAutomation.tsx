"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { provisionUpcomingMonthlySheet } from "@/app/actions/google-drive-impl";
import type { GoogleDriveConnectionStatus } from "@/lib/google-drive";

type Props = {
  nextMonthKey: string;
  notice: { tone: "success" | "warning" | "error"; text: string } | null;
  status: GoogleDriveConnectionStatus;
};

export default function GoogleDriveAutomation({
  nextMonthKey,
  notice,
  status,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const provision = () => {
    setResult(null);
    setError(null);
    startTransition(async () => {
      const response = await provisionUpcomingMonthlySheet();
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setResult(
        response.created
          ? `Таблицю ${response.monthKey} створено.`
          : response.recovered
            ? `Таблицю ${response.monthKey} знайдено та відновлено в налаштуваннях.`
            : `Таблиця ${response.monthKey} вже налаштована.`,
      );
      router.refresh();
    });
  };

  const canConnect = status.configured && status.databaseReady;

  return (
    <section className="mb-6 rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-gray-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Автоматизація Google Drive</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-slate-400">
            Після одноразового підключення FoodBalance сам створює місячні книги
            з оформленого шаблону. Власнику не потрібно щомісяця додавати URL.
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${
            status.connected
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {status.connected ? "Підключено" : "Не підключено"}
        </span>
      </div>

      {notice && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 text-emerald-800"
              : notice.tone === "warning"
                ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/40 text-amber-900 dark:text-amber-400"
                : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-400"
          }`}
        >
          {notice.text}
        </div>
      )}

      {!status.databaseReady && (
        <p className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Спочатку застосуйте оновлення Prisma-схеми до Railway PostgreSQL.
        </p>
      )}

      {status.missingEnvironmentVariables.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">У Railway відсутні або некоректні змінні:</p>
          <code className="mt-1 block break-words text-xs">
            {status.missingEnvironmentVariables.join(", ")}
          </code>
        </div>
      )}

      {status.statusError && (
        <p className="mt-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 px-4 py-3 text-sm text-red-800">
          Не вдалося прочитати стан підключення. Перевірте Railway logs.
        </p>
      )}

      {status.connected && (
        <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 dark:bg-slate-950 p-4 text-sm sm:grid-cols-2">
          <div>
            <span className="text-slate-500">Google-акаунт</span>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{status.connectedEmail}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3 sm:justify-end">
            {status.folderUrl && (
              <a
                href={status.folderUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                Відкрити папку
              </a>
            )}
            {status.templateUrl && (
              <a
                href={status.templateUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                Відкрити шаблон
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {canConnect ? (
          <a
            href="/api/admin/google-drive/connect"
            className="rounded-lg bg-gray-900 dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
          >
            {status.connected ? "Перепідключити Google Drive" : "Підключити Google Drive"}
          </a>
        ) : (
          <span className="rounded-lg bg-gray-200 dark:bg-slate-700 px-4 py-2 text-sm font-semibold text-gray-500 dark:text-slate-400">
            Підключення недоступне
          </span>
        )}

        {status.connected && (
          <button
            type="button"
            onClick={provision}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Перевірка…" : `Створити / перевірити ${nextMonthKey}`}
          </button>
        )}
      </div>

      {result && <p className="mt-3 text-sm font-medium text-emerald-700">{result}</p>}
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
    </section>
  );
}
