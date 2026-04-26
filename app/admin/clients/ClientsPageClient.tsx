"use client";

import { useState, useMemo } from "react";
import ClientEditModal from "@/components/admin/ClientEditModal";

type Client = {
  id: string;
  name: string;
  phone: string;
  chatId: string | null;
  address: string | null;
  notes: string | null;
  defaultPackage: string | null;
  _count: {
    orders: number;
  };
};

type Props = {
  clients: Client[];
};

export default function ClientsPageClient({ clients }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) {
      return clients;
    }

    const query = searchQuery.toLowerCase().trim();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.phone.toLowerCase().includes(query) ||
        client.chatId?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  return (
    <>
      <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук за ім'ям, телефоном або ChatID..."
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <div className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-sm">
            {filteredClients.length} клієнтів
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {filteredClients.length === 0 ? (
          <div className="p-12">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-lg font-semibold text-gray-700">
              {searchQuery ? "Клієнтів не знайдено" : "Клієнтів поки немає"}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {searchQuery ? "Спробуйте інший запит" : "Нові клієнти з'являться тут після першого замовлення"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-gradient-to-r from-slate-50 to-blue-50 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-4 sm:px-6">ПІБ</th>
                  <th className="px-4 py-4 sm:px-6">Телефон</th>
                  <th className="px-4 py-4 sm:px-6">Telegram</th>
                  <th className="px-4 py-4 sm:px-6">Адреса</th>
                  <th className="px-4 py-4 sm:px-6">Тариф</th>
                  <th className="px-4 py-4 sm:px-6">Замовлень</th>
                  <th className="px-4 py-4 sm:px-6">Нотатки</th>
                  <th className="px-4 py-4 sm:px-6">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                    <td className="px-4 py-5 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white font-bold text-sm">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-semibold text-slate-900">{client.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-5 sm:px-6">
                      <a
                        href={`tel:${client.phone}`}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {client.phone}
                      </a>
                    </td>
                    <td className="px-4 py-5 sm:px-6">
                      {client.chatId ? (
                        <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700">
                          <span>✓</span>
                          <span>Підключено</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-500">
                          <span>—</span>
                          <span>Немає</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-5 sm:px-6">
                      <div className="max-w-xs text-sm text-slate-700">
                        {client.address || (
                          <span className="text-slate-400 italic">Не вказано</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-5 sm:px-6">
                      {client.defaultPackage ? (
                        <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-100 px-3 py-1.5">
                          <span className="text-sm font-bold text-indigo-700">{client.defaultPackage}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-5 sm:px-6">
                      <div className="inline-flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-1.5">
                        <span className="text-sm font-bold text-blue-700">{client._count.orders}</span>
                      </div>
                    </td>
                    <td className="px-4 py-5 sm:px-6">
                      <div className="max-w-xs">
                        {client.notes ? (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                            {client.notes}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-5 sm:px-6">
                      <button
                        onClick={() => setEditingClient(client)}
                        className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:shadow-lg hover:scale-105"
                      >
                        Редагувати
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingClient && (
        <ClientEditModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
        />
      )}
    </>
  );
}
