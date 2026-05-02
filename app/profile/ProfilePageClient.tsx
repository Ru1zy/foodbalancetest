"use client";

import { useState } from "react";
import { updateUserProfile } from "../actions/profile";
import { isIndivPackage } from "@/lib/order-selection";
import SubscriptionOptions from "@/components/SubscriptionOptions";

type User = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  defaultCutlery: number | null;
};

export type ResolvedDay = {
  date: Date;
  dishes: string[];
};

export type OrderWithResolvedDishes = {
  id: string;
  createdAt: Date;
  deliveryDate: Date;
  packageType: string;
  price: number | null;
  isPaid: boolean;
  resolvedDays: ResolvedDay[];
};

export type UserBalanceSummary = {
  packageId: string;
  remainingDays: number;
};

type Tariff = {
  id: string;
  name: string;
  basePrice: number;
};

type Props = {
  user: User;
  orders: OrderWithResolvedDishes[];
  balances: UserBalanceSummary[];
  tariffs: Tariff[];
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Kiev",
  }).format(new Date(date));
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Kiev",
  }).format(new Date(date));
}

export default function ProfilePageClient({ user, orders, balances, tariffs }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(tariffs[0]?.id || "");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await updateUserProfile(formData);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-8 text-3xl font-bold text-gray-900 sm:text-4xl">
          Профіль
        </h1>

        {/* Balances Section */}
        {balances.length > 0 && (
          <div className="mb-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm sm:p-8">
            <h2 className="mb-6 text-2xl font-bold text-emerald-900">Мої абонементи</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {balances.map((balance) => (
                <div key={balance.packageId} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-emerald-200">
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">{balance.packageId}</div>
                  <div className="text-2xl font-black text-slate-900">Залишилось: {balance.remainingDays} днів</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Purchase Subscription Section */}
        <div className="mb-8 rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm sm:p-8">
          <h2 className="mb-6 text-2xl font-bold text-blue-900">Придбати абонемент</h2>
          
          <div className="mb-6 flex flex-wrap gap-2">
            {tariffs.filter(t => t.name !== "Template").map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                  activeTab === t.id
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white text-blue-600 hover:bg-blue-50"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          {tariffs.find(t => t.id === activeTab) && (
            <SubscriptionOptions pkg={tariffs.find(t => t.id === activeTab)!} />
          )}
        </div>

        {/* Settings Section */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Налаштування</h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl sm:w-auto"
            >
              <span>{isEditing ? "✕" : "✏️"}</span>
              <span>{isEditing ? "Скасувати" : "Редагувати"}</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Ім&apos;я</label>
                <input
                  name="name"
                  defaultValue={user.name}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Телефон</label>
                <input
                  name="phone"
                  defaultValue={user.phone || ""}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Адреса за замовчуванням</label>
                <input
                  name="address"
                  defaultValue={user.address || ""}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Прибори за замовчуванням</label>
                <select
                  name="cutlery"
                  defaultValue={user.defaultCutlery || 0}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl sm:w-auto"
              >
                <span>💾</span>
                <span>Зберегти</span>
              </button>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Ім&apos;я</dt>
                <dd className="text-base font-medium text-slate-900">{user.name}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Телефон</dt>
                <dd className="text-base font-medium text-slate-900">{user.phone || "Не вказано"}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Адреса</dt>
                <dd className="text-base font-medium text-slate-900 break-words">{user.address || "Не вказано"}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Прибори</dt>
                <dd className="text-base font-medium text-slate-900">{user.defaultCutlery || 0} шт</dd>
              </div>
            </dl>
          )}
        </div>

        {/* Order History Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Історія замовлень</h2>
          {orders.length === 0 ? (
            <div className="rounded-xl bg-gray-50 p-12">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-lg font-semibold text-gray-700">Немає замовлень</p>
              <p className="text-sm text-gray-500 mt-2">Ваші замовлення з&apos;являться тут</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                return (
                  <div
                    key={order.id}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-6"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                      <div className="min-w-0">
                        <p className="break-words text-lg font-bold text-slate-900">
                          {order.packageType}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                          Створено: {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-2">
                        {isIndivPackage(order.packageType) ? (
                          <p className="text-xl font-bold text-emerald-600">Індивідуальний розрахунок</p>
                        ) : (
                          order.price && (
                            <p className="text-xl font-bold text-slate-900">{order.price} ₴</p>
                          )
                        )}
                        {order.isPaid && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                            <span>✓</span>
                            <span>Оплачено</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Days with Dishes */}
                    {order.resolvedDays.length > 0 && (
                      <div className="space-y-3">
                        {order.resolvedDays.map((day, dayIndex) => (
                          <div key={dayIndex} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-bold text-slate-900 mb-3">
                              📅 День {dayIndex + 1} — {formatShortDate(day.date)}
                            </p>
                            {day.dishes.length > 0 ? (
                              <ul className="space-y-2">
                                {day.dishes.map((dish, dishIndex) => (
                                  <li key={dishIndex} className="flex items-start gap-2 text-sm text-slate-700">
                                    <span className="text-blue-600 mt-0.5">•</span>
                                    <span className="break-words">{dish}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-slate-500 italic">Немає страв</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
