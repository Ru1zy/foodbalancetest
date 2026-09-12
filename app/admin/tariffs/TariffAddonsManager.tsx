"use client";

import { useState } from "react";
import {
  TariffAddon,
  saveTariffAddonAction,
  deleteTariffAddonAction,
  toggleTariffAddonAction,
} from "@/app/actions/tariff-impl";
import { Plus, X, Check, Edit2, Trash2, Sparkles, Tag, Layers, Globe } from "lucide-react";

interface Props {
  initialAddons: TariffAddon[];
}

const PACKAGE_OPTIONS = [
  { id: "ALL", label: "🌐 Загальний (для всіх раціонів)" },
  { id: "Sport", label: "⚡ Sport Active+" },
  { id: "Slim", label: "🥗 Slim" },
  { id: "Balance", label: "⚖️ Balance" },
  { id: "Active", label: "🏃 Active" },
  { id: "Sushka", label: "🥩 Sushka Light" },
  { id: "Indiv", label: "🛠️ Індивідуальний" },
];

const PRICE_TYPE_OPTIONS = [
  { id: "per_day", label: "₴ / день (на кожен день замовлення)" },
  { id: "per_100_kcal", label: "₴ / 100 ккал на день (модульні калорії)" },
  { id: "per_unit", label: "₴ / порція (за 1 шт)" },
  { id: "fixed", label: "₴ фіксовано (разова доплата за замовлення)" },
];

export default function TariffAddonsManager({ initialAddons }: Props) {
  const [addons, setAddons] = useState<TariffAddon[]>(initialAddons);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [packageId, setPackageId] = useState("Sport");
  const [price, setPrice] = useState<number>(35);
  const [priceType, setPriceType] = useState<TariffAddon["priceType"]>("per_100_kcal");
  const [unitLabel, setUnitLabel] = useState("за 100 ккал / день");
  const [maxLimit, setMaxLimit] = useState<number>(10);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setTitle("");
    setPackageId("ALL");
    setPrice(50);
    setPriceType("per_day");
    setUnitLabel("за день");
    setMaxLimit(1);
    setDescription("");
    setIsActive(true);
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (addon: TariffAddon) => {
    setEditingId(addon.id);
    setTitle(addon.title);
    setPackageId(addon.packageId);
    setPrice(addon.price);
    setPriceType(addon.priceType);
    setUnitLabel(addon.unitLabel || "");
    setMaxLimit(addon.maxLimit || 1);
    setDescription(addon.description || "");
    setIsActive(addon.isActive);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFeedbackMsg({ type: "error", text: "Вкажіть назву допу" });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMsg(null);

    try {
      const res = await saveTariffAddonAction({
        id: editingId || undefined,
        title: title.trim(),
        packageId,
        price: Number(price) || 0,
        priceType,
        unitLabel: unitLabel.trim() || undefined,
        maxLimit: Number(maxLimit) || 1,
        description: description.trim() || undefined,
        isActive,
      });

      if (res.ok && res.addons) {
        setAddons(res.addons);
        setFeedbackMsg({
          type: "success",
          text: editingId ? "Доп успішно оновлено!" : "Новий доп успішно додано!",
        });
        resetForm();
      } else {
        setFeedbackMsg({ type: "error", text: res.error || "Помилка збереження" });
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Помилка під час відправки даних" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Ви дійсно бажаєте видалити доп "${name}"?`)) return;

    try {
      const res = await deleteTariffAddonAction(id);
      if (res.ok && res.addons) {
        setAddons(res.addons);
        setFeedbackMsg({ type: "success", text: "Доп видалено" });
      } else {
        setFeedbackMsg({ type: "error", text: res.error || "Помилка при видаленні" });
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Помилка при видаленні" });
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await toggleTariffAddonAction(id, !currentStatus);
      if (res.ok && res.addons) {
        setAddons(res.addons);
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Помилка зміни статусу" });
    }
  };

  const getPackageBadge = (pkgId: string) => {
    switch (pkgId) {
      case "ALL":
        return {
          label: "Загальний (усі раціони)",
          cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border-purple-200 dark:border-purple-800",
        };
      case "Sport":
        return {
          label: "Sport Active+",
          cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        };
      case "Slim":
        return {
          label: "Slim",
          cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        };
      case "Active":
        return {
          label: "Active",
          cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800",
        };
      case "Balance":
        return {
          label: "Balance",
          cls: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 border-teal-200 dark:border-teal-800",
        };
      case "Sushka":
        return {
          label: "Sushka Light",
          cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-rose-200 dark:border-rose-800",
        };
      default:
        return {
          label: pkgId,
          cls: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
        };
    }
  };

  const getPriceTypeLabel = (addon: TariffAddon) => {
    if (addon.unitLabel) return `+${addon.price} ₴ (${addon.unitLabel})`;
    switch (addon.priceType) {
      case "per_100_kcal":
        return `+${addon.price} ₴ / 100 ккал/день`;
      case "per_day":
        return `+${addon.price} ₴ / день`;
      case "per_unit":
        return `+${addon.price} ₴ / порція`;
      case "fixed":
        return `+${addon.price} ₴ фіксовано`;
      default:
        return `+${addon.price} ₴`;
    }
  };

  return (
    <div className="mt-10 rounded-2xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm ring-1 ring-gray-200 dark:ring-slate-800">
      {/* Header with + button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <span>⚡</span> Модульні допи та модифікатори
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Керуйте списком додаткових опцій до замовлень (додаткові калорії, добавки, порції). Загальні для всіх або окремі для конкретного раціону.
          </p>
        </div>

        <button
          type="button"
          onClick={() => (isFormOpen ? resetForm() : handleOpenCreate())}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition shrink-0 ${
            isFormOpen
              ? "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
              : "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600"
          }`}
        >
          {isFormOpen ? (
            <>
              <X className="w-4 h-4" /> Закрити форму
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Додати доп
            </>
          )}
        </button>
      </div>

      {feedbackMsg && (
        <div
          className={`my-4 p-3 rounded-xl text-sm font-medium ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* DROPDOWN FORM (Unfolds when clicking + Додати доп or ✏️ Edit) */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="my-6 rounded-2xl border-2 border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10 p-5 sm:p-6 transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {editingId ? "Редагування допу" : "Нова додаткова опція (доп)"}
            </h3>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              Заповніть назву, тариф та ціну
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Title */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Назва допу *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="напр. +100 ккал або Додатковий протеїн 50г"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Target Package (General vs Specific) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Раціон (общий або окремий)
              </label>
              <select
                value={packageId}
                onChange={(e) => {
                  const val = e.target.value;
                  setPackageId(val);
                  if (val === "Sport") {
                    setPriceType("per_100_kcal");
                    setUnitLabel("за 100 ккал / день");
                    setMaxLimit(10);
                  } else {
                    setPriceType("per_day");
                    setUnitLabel("за день");
                    setMaxLimit(1);
                  }
                }}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                {PACKAGE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Ціна (грн) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-2 text-sm font-semibold text-gray-400">
                  ₴
                </span>
              </div>
            </div>

            {/* Price Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Періодичність / Тип ціни
              </label>
              <select
                value={priceType}
                onChange={(e) => setPriceType(e.target.value as TariffAddon["priceType"])}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                {PRICE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Label */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Підпис одиниці (опціонально)
              </label>
              <input
                type="text"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="напр. за день або за 100 ккал"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Max Limit */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Макс. ліміт (кроків/порцій)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={maxLimit}
                onChange={(e) => setMaxLimit(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Опис / примітка (для кухні або підказки клієнту)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="напр. Лічильник у кошику до 10 кліків. Передається в нотатки замовлення."
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Is Active Toggle */}
            <div className="flex items-center gap-3 pt-4 sm:pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                <span className="ml-3 text-xs font-semibold text-gray-700 dark:text-slate-300">
                  {isActive ? "🟢 Активний" : "⚪ Призупинено"}
                </span>
              </label>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3 pt-4 border-t border-emerald-500/20">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl px-4 py-2 text-xs font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-200/50 dark:hover:bg-slate-800 transition"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 text-xs font-bold shadow transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? "Збереження..." : editingId ? "Оновити доп" : "Зберегти новий доп"}
            </button>
          </div>
        </form>
      )}

      {/* LIST OF CONFIGURED ADDONS */}
      <div className="mt-6 space-y-3">
        {addons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-slate-800 p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Поки що немає налаштованих допів. Натисніть кнопку вище, щоб додати перший.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {addons.map((addon) => {
              const badge = getPackageBadge(addon.packageId);
              return (
                <div
                  key={addon.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 transition ${
                    addon.isActive
                      ? "border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/40 hover:border-gray-300 dark:hover:border-slate-700"
                      : "border-gray-200 dark:border-slate-800 bg-gray-100/40 dark:bg-slate-900/30 opacity-70"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                      {addon.packageId === "ALL" ? (
                        <Globe className="w-5 h-5" />
                      ) : (
                        <Layers className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                          {addon.title}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        {addon.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                            Активний
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-200 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
                            Вимкнено
                          </span>
                        )}
                      </div>
                      {addon.description && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400 line-clamp-1">
                          {addon.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200 dark:border-slate-800 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {getPriceTypeLabel(addon)}
                      </div>
                      {addon.maxLimit && addon.maxLimit > 1 && (
                        <div className="text-[11px] text-gray-400">
                          макс. {addon.maxLimit} крок.
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(addon.id, addon.isActive)}
                        title={addon.isActive ? "Вимкнути доп" : "Увімкнути доп"}
                        className="rounded-lg p-2 text-gray-500 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(addon)}
                        title="Редагувати"
                        className="rounded-lg p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(addon.id, addon.title)}
                        title="Видалити"
                        className="rounded-lg p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2.5">
        <span className="text-base leading-none">💡</span>
        <p>
          <strong>Як це працює:</strong> Зараз у кошику активний доп збільшення калоражу для тарифу <em>Sport Active+</em> (+35 ₴/100 ккал). Створені тут нові допи зберігаються в системній конфігурації платформи і можуть використовуватись менеджерами для розрахунку індивідуальних доплат та майбутніх модулів розширення раціонів.
        </p>
      </div>
    </div>
  );
}
