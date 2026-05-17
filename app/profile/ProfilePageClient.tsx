"use client";

import { useState } from "react";
import { updateUserProfile } from "../actions/profile";
import { isIndivPackage } from "@/lib/order-selection";
import SubscriptionOptions from "@/components/SubscriptionOptions";
import { 
  Package, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ForkKnife,
  Settings,
  CreditCard,
  User as UserIcon,
  MapPin,
  Utensils
} from "lucide-react";

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
  balanceDaysUsed: number;
  isPaid: boolean;
  resolvedDays: ResolvedDay[];
  status?: string; // Optional if not always present
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
  isNewClient: boolean;
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

function OrderCard({ order }: { order: OrderWithResolvedDishes }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusInfo = (status: string | undefined, isPaid: boolean) => {
    if (status === "delivered" || status === "archived") {
      return { 
        label: "Доставлено", 
        classes: "bg-gray-100 text-gray-700 border-gray-200", 
        icon: <CheckCircle2 className="w-3 h-3" /> 
      };
    }
    if (isPaid) {
      return { 
        label: "Оплачено", 
        classes: "bg-emerald-100 text-emerald-700 border-emerald-200", 
        icon: <CheckCircle2 className="w-3 h-3" /> 
      };
    }
    return { 
      label: "Очікує оплати", 
      classes: "bg-amber-100 text-amber-700 border-amber-200", 
      icon: <Clock className="w-3 h-3" /> 
    };
  };

  const statusInfo = getStatusInfo(order.status, order.isPaid);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      {/* Card Header */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{order.packageType}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(order.createdAt)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusInfo.classes}`}>
              {statusInfo.icon}
              {statusInfo.label}
            </span>
            
            <div className="text-right">
              {isIndivPackage(order.packageType) ? (
                <p className="text-sm font-bold text-emerald-600">Індивідуальний розрахунок</p>
              ) : order.balanceDaysUsed > 0 ? (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">
                    З балансу: {order.balanceDaysUsed}д
                  </span>
                  {order.price !== null && order.price > 0 ? (
                    <p className="text-lg font-black text-gray-900">{order.price} ₴</p>
                  ) : (
                    <p className="text-sm font-bold text-emerald-600">Оплачено днями</p>
                  )}
                </div>
              ) : (
                order.price !== null && (
                  <p className="text-lg font-black text-gray-900">{order.price} ₴</p>
                )
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Сховати деталі</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Деталі меню</span>
              </>
            )}
          </button>
          
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 hover:border-gray-300"
            onClick={() => alert("Повтор замовлення у розробці")}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Повторити</span>
          </button>
        </div>
      </div>

      {/* Expandable Details */}
      {isExpanded && (
        <div className="bg-gray-50 border-t border-gray-100 p-5 sm:p-6">
          <div className="space-y-4">
            {order.resolvedDays.map((day, idx) => (
              <div key={idx} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200/50">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">
                    День {idx + 1} — {formatShortDate(day.date)}
                  </p>
                  <ForkKnife className="w-4 h-4 text-gray-400" />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {day.dishes.map((dish, dishIdx) => (
                    <div key={dishIdx} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                      <span className="break-words">{dish}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePageClient({ user, orders, balances, tariffs, isNewClient }: Props) {
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
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">
            Профіль
          </h1>
          <p className="text-gray-500 mt-2 font-medium">Керування вашими даними та замовленнями</p>
        </header>

        {/* Balances Section */}
        {balances.length > 0 && (
          <div className="mb-10 rounded-3xl border border-emerald-100 bg-emerald-50/50 p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <CreditCard className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-emerald-900">Мої абонементи</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {balances.map((balance) => (
                <div key={balance.packageId} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-emerald-100 transition hover:shadow-md">
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">{balance.packageId}</div>
                  <div className="text-3xl font-black text-slate-900 leading-none">
                    {balance.remainingDays} <span className="text-lg font-bold text-slate-500">днів</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-3 font-medium">Доступно для замовлення</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Purchase Subscription Section */}
        <div className="mb-10 rounded-3xl border border-blue-100 bg-blue-50/50 p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-blue-900">Придбати абонемент</h2>
          </div>
          
          <div className="mb-8 flex flex-wrap gap-2">
            {tariffs
              .filter(t => t.name !== "Template" && !t.name.toLowerCase().includes("indiv"))
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
                    activeTab === t.id
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                      : "bg-white text-blue-600 hover:bg-blue-50 border border-blue-100"
                  }`}
                >
                  {t.name}
                </button>
              ))}
          </div>

          {tariffs.find(t => t.id === activeTab) && (
            <SubscriptionOptions 
              pkg={tariffs.find(t => t.id === activeTab)!} 
              isNewClient={isNewClient}
            />
          )}
        </div>

        {/* Settings Section */}
        <div className="mb-10 rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Settings className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Налаштування</h2>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 sm:w-auto active:scale-95"
            >
              <span>{isEditing ? "✕" : "✏️"}</span>
              <span>{isEditing ? "Скасувати" : "Редагувати"}</span>
            </button>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Ім&apos;я</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    name="name"
                    defaultValue={user.name}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm text-gray-900 placeholder-gray-500 transition focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div className="sm:col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Телефон</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">📞</span>
                  <input
                    name="phone"
                    defaultValue={user.phone || ""}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm text-gray-900 placeholder-gray-500 transition focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Адреса за замовчуванням</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    name="address"
                    defaultValue={user.address || ""}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm text-gray-900 placeholder-gray-500 transition focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="sm:col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Прибори за замовчуванням</label>
                <div className="relative">
                  <Utensils className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    name="cutlery"
                    defaultValue={user.defaultCutlery || 0}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm text-gray-900 appearance-none transition focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value={0}>0</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                  </select>
                </div>
              </div>
              <div className="sm:col-span-2 mt-2">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 sm:w-auto active:scale-95"
                >
                  <span>Зберегти зміни</span>
                </button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
                <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Ім&apos;я</dt>
                <dd className="text-base font-bold text-slate-900">{user.name}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
                <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Телефон</dt>
                <dd className="text-base font-bold text-slate-900">{user.phone || "Не вказано"}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100 sm:col-span-2">
                <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Адреса доставки</dt>
                <dd className="text-base font-bold text-slate-900 break-words">{user.address || "Не вказано"}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
                <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Прибори</dt>
                <dd className="text-base font-bold text-slate-900">{user.defaultCutlery || 0} шт</dd>
              </div>
            </dl>
          )}
        </div>

        {/* Order History Section */}
        <div className="space-y-6 pb-12">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Історія замовлень</h2>
            {orders.length > 0 && (
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-black text-slate-600">
                {orders.length}
              </span>
            )}
          </div>

          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-gray-200 bg-white p-16 text-center shadow-sm">
              <div className="mb-6 rounded-3xl bg-slate-50 p-8">
                <Package className="h-16 w-16 text-slate-200" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">У вас ще немає замовлень</h3>
              <p className="mt-3 max-w-xs text-sm text-gray-500 font-medium">
                Оформіть своє перше замовлення, і воно з&apos;явиться у цьому розділі.
              </p>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="mt-10 rounded-2xl bg-slate-900 px-8 py-4 text-sm font-black text-white shadow-xl shadow-slate-200 transition hover:bg-slate-800 active:scale-95"
              >
                Оформити замовлення
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
