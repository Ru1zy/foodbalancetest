"use client";

import { useState, useTransition } from "react";
import { updateMenuDishes } from "@/app/actions/menu-impl";

type DishVariant = {
  full: string;
  short: string;
};

type DishesStructure = {
  breakfast: DishVariant[];
  lunch: DishVariant[];
  dinner: DishVariant[];
  snack: DishVariant[];
};

type Props = {
  menuId: string;
  currentDishes: unknown;
  packageType: string;
  dayOfWeek: number;
};

const CATEGORY_LABELS: Record<keyof DishesStructure, string> = {
  breakfast: "Сніданок",
  lunch: "Обід",
  dinner: "Вечеря",
  snack: "Перекус",
};

const DAY_NAMES = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];

export default function MenuDishesEditor({ menuId, currentDishes, packageType, dayOfWeek }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Parse current dishes or initialize empty structure
  const parseDishes = (): DishesStructure => {
    if (!currentDishes || typeof currentDishes !== "object") {
      return {
        breakfast: [],
        lunch: [],
        dinner: [],
        snack: [],
      };
    }

    const parsed = currentDishes as Record<string, unknown>;
    return {
      breakfast: Array.isArray(parsed.breakfast) ? parsed.breakfast : [],
      lunch: Array.isArray(parsed.lunch) ? parsed.lunch : [],
      dinner: Array.isArray(parsed.dinner) ? parsed.dinner : [],
      snack: Array.isArray(parsed.snack) ? parsed.snack : [],
    };
  };

  const [dishes, setDishes] = useState<DishesStructure>(parseDishes());

  const handleOpen = () => {
    setDishes(parseDishes());
    setMessage(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const addVariant = (category: keyof DishesStructure) => {
    setDishes((prev) => ({
      ...prev,
      [category]: [...prev[category], { full: "", short: "" }],
    }));
  };

  const removeVariant = (category: keyof DishesStructure, index: number) => {
    setDishes((prev) => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index),
    }));
  };

  const updateVariant = (
    category: keyof DishesStructure,
    index: number,
    field: "full" | "short",
    value: string
  ) => {
    setDishes((prev) => ({
      ...prev,
      [category]: prev[category].map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant
      ),
    }));
  };

  const handleSubmit = () => {
    setMessage(null);

    // Filter out empty variants
    const cleanedDishes: DishesStructure = {
      breakfast: dishes.breakfast.filter((v) => v.full.trim() || v.short.trim()),
      lunch: dishes.lunch.filter((v) => v.full.trim() || v.short.trim()),
      dinner: dishes.dinner.filter((v) => v.full.trim() || v.short.trim()),
      snack: dishes.snack.filter((v) => v.full.trim() || v.short.trim()),
    };

    startTransition(async () => {
      const result = await updateMenuDishes(menuId, cleanedDishes);

      if (result.ok) {
        setMessage({ type: "success", text: "✓ Меню успішно оновлено!" });
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setMessage({ type: "error", text: `✗ ${result.message}` });
      }
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
      >
        <span>📝</span>
        <span>Редагувати страви</span>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Редагування страв
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {DAY_NAMES[dayOfWeek]} • {packageType}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {(Object.keys(dishes) as Array<keyof DishesStructure>).map((category) => (
              <div key={category} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <button
                    onClick={() => addVariant(category)}
                    className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700"
                  >
                    <span>+</span>
                    <span>Додати варіант</span>
                  </button>
                </div>

                {dishes[category].length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Немає варіантів</p>
                ) : (
                  <div className="space-y-3">
                    {dishes[category].map((variant, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 rounded-lg bg-white p-3 shadow-sm"
                      >
                        <div className="flex-1 space-y-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Повна назва
                            </label>
                            <input
                              type="text"
                              value={variant.full}
                              onChange={(e) =>
                                updateVariant(category, index, "full", e.target.value)
                              }
                              placeholder="Омлет з овочами та зеленню"
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Коротка назва
                            </label>
                            <input
                              type="text"
                              value={variant.short}
                              onChange={(e) =>
                                updateVariant(category, index, "short", e.target.value)
                              }
                              placeholder="Омлет"
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => removeVariant(category, index)}
                          className="mt-6 rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                          title="Видалити варіант"
                        >
                          <span className="text-xl">🗑️</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
            {message && (
              <div
                className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
                  message.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleClose}
                disabled={isPending}
                className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Скасувати
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:opacity-50"
              >
                <span>{isPending ? "⏳" : "💾"}</span>
                <span>{isPending ? "Збереження..." : "Зберегти"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
