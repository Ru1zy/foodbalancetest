"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSheetConfig,
  updateSheetConfig,
  deleteSheetConfig,
} from "@/app/actions/sheet-config-impl";
import { isValidMonthKey } from "@/lib/sheet-config-validation";

type SheetConfig = {
  id: string;
  monthKey: string;
  spreadsheetId: string;
  label: string | null;
};

type Props = {
  configs: SheetConfig[];
};

const inputClass =
  "w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

export default function SheetConfigManager({ configs }: Props) {
  return (
    <div className="space-y-6">
      <CreateForm />

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Місяць (MM.YYYY)
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Назва
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Spreadsheet ID
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Дії
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {configs.map((config) => (
                <ConfigRow key={config.id} config={config} />
              ))}
            </tbody>
          </table>
        </div>

        {configs.length === 0 && (
          <div className="border-t border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-600">
              Конфігурації відсутні. Додайте першу таблицю через форму вище.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [monthKey, setMonthKey] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const monthKeyTouched = monthKey.trim().length > 0;
  const monthKeyValid = isValidMonthKey(monthKey);
  const canSubmit =
    monthKeyValid && spreadsheetId.trim().length > 0 && !isPending;

  const handleSubmit = () => {
    setError(null);
    if (!isValidMonthKey(monthKey)) {
      setError("Невірний формат місяця. Очікується MM.YYYY (напр. 03.2026).");
      return;
    }
    if (!spreadsheetId.trim()) {
      setError("ID таблиці не може бути порожнім.");
      return;
    }

    startTransition(async () => {
      const res = await createSheetConfig({ monthKey, spreadsheetId, label });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMonthKey("");
      setSpreadsheetId("");
      setLabel("");
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Додати таблицю</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Місяць (MM.YYYY) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="03.2026"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className={`${inputClass} ${
              monthKeyTouched && !monthKeyValid
                ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                : ""
            }`}
          />
          {monthKeyTouched && !monthKeyValid && (
            <p className="mt-1 text-xs text-red-600">Формат: MM.YYYY (01-12, рік).</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Назва (необов&apos;язково)</label>
          <input
            type="text"
            placeholder="Березень 2026"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Spreadsheet ID або URL <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="1AbC... або повне посилання"
            value={spreadsheetId}
            onChange={(e) => setSpreadsheetId(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Додавання…" : "Додати"}
        </button>
      </div>
    </div>
  );
}

function ConfigRow({ config }: { config: SheetConfig }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [monthKey, setMonthKey] = useState(config.monthKey);
  const [spreadsheetId, setSpreadsheetId] = useState(config.spreadsheetId);
  const [label, setLabel] = useState(config.label ?? "");

  const monthKeyValid = isValidMonthKey(monthKey);

  const resetForm = () => {
    setMonthKey(config.monthKey);
    setSpreadsheetId(config.spreadsheetId);
    setLabel(config.label ?? "");
    setError(null);
  };

  const handleSave = () => {
    setError(null);
    if (!isValidMonthKey(monthKey)) {
      setError("Формат місяця: MM.YYYY.");
      return;
    }
    if (!spreadsheetId.trim()) {
      setError("ID таблиці не може бути порожнім.");
      return;
    }
    startTransition(async () => {
      const res = await updateSheetConfig(config.id, {
        monthKey,
        spreadsheetId,
        label,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteSheetConfig(config.id);
      if (!res.ok) {
        setError(res.error);
        setConfirmingDelete(false);
        return;
      }
      router.refresh();
    });
  };

  if (editing) {
    return (
      <tr className="bg-blue-50">
        <td className="px-6 py-4 align-top">
          <input
            type="text"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className={`${inputClass} ${
              monthKeyValid ? "" : "border-red-400 focus:border-red-500 focus:ring-red-500"
            }`}
          />
          {!monthKeyValid && (
            <p className="mt-1 text-xs text-red-600">MM.YYYY</p>
          )}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
        <td className="px-6 py-4 align-top">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputClass}
          />
        </td>
        <td className="px-6 py-4 align-top">
          <input
            type="text"
            value={spreadsheetId}
            onChange={(e) => setSpreadsheetId(e.target.value)}
            className={inputClass}
          />
        </td>
        <td className="px-6 py-4 align-top">
          <div className="flex justify-end gap-2">
            <button
              onClick={handleSave}
              disabled={isPending || !monthKeyValid}
              className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-40"
            >
              {isPending ? "…" : "Зберегти"}
            </button>
            <button
              onClick={() => {
                resetForm();
                setEditing(false);
              }}
              disabled={isPending}
              className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300"
            >
              Скасувати
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{config.monthKey}</td>
      <td className="px-6 py-4 text-sm text-gray-600">{config.label || "—"}</td>
      <td className="px-6 py-4">
        <code className="break-all text-xs text-gray-600">{config.spreadsheetId}</code>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col items-end gap-2">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {confirmingDelete ? (
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-40"
              >
                {isPending ? "…" : "Підтвердити"}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={isPending}
                className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300"
              >
                Ні
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              >
                Редагувати
              </button>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="rounded bg-red-50 px-3 py-1 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100"
              >
                Видалити
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
