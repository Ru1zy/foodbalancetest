"use client";

import { useState } from "react";
import { updateUserProfile } from "../actions/profile";
import { getOrderStatusLabel } from "@/src/lib/order-status";

type User = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  defaultCutlery: number | null;
  // other fields if needed
};

type Order = {
  id: string;
  createdAt: Date;
  status: string;
  items: unknown; // JSON
  price: number | null;
  deliveryDate: Date;
  packageType: string;
  // other fields
};

type Props = {
  user: User;
  orders: Order[];
};

export default function ProfilePageClient({ user, orders }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold text-black">Профіль</h1>

        {/* Settings Section */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-black">Налаштування</h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {isEditing ? "Скасувати" : "Редагувати"}
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black">Ім&apos;я</label>
              <input
                name="name"
                defaultValue={user.name}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black">Телефон</label>
              <input
                name="phone"
                defaultValue={user.phone || ""}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black">Адреса за замовчуванням</label>
              <input
                name="address"
                defaultValue={user.address || ""}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black">Прибори за замовчуванням</label>
              <select
                name="cutlery"
                defaultValue={user.defaultCutlery || 0}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
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
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Зберегти
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <div>
              <span className="font-medium text-black">Ім&apos;я:</span> <span className="text-gray-700">{user.name}</span>
            </div>
            <div>
              <span className="font-medium text-black">Телефон:</span> <span className="text-gray-700">{user.phone || "Не вказано"}</span>
            </div>
            <div>
              <span className="font-medium text-black">Адреса:</span> <span className="text-gray-700">{user.address || "Не вказано"}</span>
            </div>
            <div>
              <span className="font-medium text-black">Прибори:</span> <span className="text-gray-700">{user.defaultCutlery || 0}</span>
            </div>
          </div>
        )}
        </div>

        {/* Order History Section */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-black">Історія замовлень</h2>
          {orders.length === 0 ? (
            <p className="text-gray-700">Немає замовлень</p>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-black">
                        Замовлення від {new Date(order.createdAt).toLocaleDateString("uk-UA")}
                      </p>
                      <p className="text-sm text-gray-700">
                        Статус: {order.status} | Пакет: {order.packageType} | Дата доставки: {new Date(order.deliveryDate).toLocaleDateString("uk-UA")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-black">{order.price ? `${order.price} грн` : "Ціна не вказана"}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    Статус: <span className="font-medium text-black">{getOrderStatusLabel(order.status)}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    {/* TODO: Format items properly */}
                    Items summary here
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}