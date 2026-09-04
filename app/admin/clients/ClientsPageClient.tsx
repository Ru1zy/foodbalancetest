"use client";

import { useState, useMemo } from "react";
import ClientEditModal from "@/components/admin/ClientEditModal";
import SyncedHorizontalScroll from "@/components/admin/SyncedHorizontalScroll";

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
  balances: {
    packageId: string;
    totalDays: number;
    usedDays: number;
  }[];
};

type Props = {
  clients: Client[];
};

function getEffectiveChatId(client: { chatId: string | null; phone: string }): string | null {
  if (client.chatId) return client.chatId;
  if (client.phone.startsWith("telegram-user:")) {
    return client.phone.replace("telegram-user:", "").trim();
  }
  if (client.phone.startsWith("tg_")) {
    return client.phone.replace("tg_", "").trim();
  }
  return null;
}

export default function ClientsPageClient({ clients }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const filteredClients = useMemo(() => {
    if (!(searchQuery || "").trim()) {
      return clients;
    }

    const query = searchQuery.toLowerCase().trim();
    return clients.filter((client) => {
      const effectiveChatId = getEffectiveChatId(client);
      return (
        client.name.toLowerCase().includes(query) ||
        client.phone.toLowerCase().includes(query) ||
        (effectiveChatId && effectiveChatId.toLowerCase().includes(query)) ||
        (client.address && client.address.toLowerCase().includes(query))
      );
    });
  }, [clients, searchQuery]);

  return (
    <>
      <div className="mb-6 rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук за ім'ям, телефоном або ChatID..."
              className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-gray-900 dark:text-slate-100 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <div className="rounded-xl bg-gray-900 dark:bg-slate-800 px-5 py-3 text-sm font-bold text-white shadow-sm">
            {filteredClients.length} клієнтів
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
        {filteredClients.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">
              {searchQuery ? "Клієнтів не знайдено" : "Клієнтів поки немає"}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
              {searchQuery ? "Спробуйте інший запит" : "Нові клієнти з'являться тут після першого замовлення"}
            </p>
          </div>
        ) : (
          <SyncedHorizontalScroll>
            <table className="min-w-full border-collapse">
              <thead className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-800/80 text-left text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
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
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredClients.map((client) => {
                  const effectiveChatId = getEffectiveChatId(client);
                  const isPlaceholderPhone = client.phone.startsWith("telegram-user:") || 
                    client.phone.startsWith("tg_") || 
                    client.phone.startsWith("google_");

                  return (
                    <tr key={client.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors duration-150">
                      <td className="px-4 py-5 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white font-bold text-sm">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{client.name}</div>
                            {client.balances.filter(b => b.totalDays - b.usedDays > 0).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {client.balances
                                  .filter(b => b.totalDays - b.usedDays > 0)
                                  .map(b => (
                                    <span key={b.packageId} className="inline-flex items-center rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                      {b.packageId}: {b.totalDays - b.usedDays}д
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5 sm:px-6">
                        {isPlaceholderPhone ? (
                          <span className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 italic">
                            {client.phone.startsWith("google_") ? "Google (без тел.)" : "Telegram (без тел.)"}
                          </span>
                        ) : (
                          <a
                            href={`tel:${client.phone}`}
                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                          >
                            {client.phone}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-5 sm:px-6">
                        {effectiveChatId ? (
                          <div className="flex flex-col gap-1 items-start">
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-green-700 dark:text-emerald-300">
                              <span>✓</span>
                              <span>Підключено</span>
                            </div>
                            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 select-all" title="Telegram ChatID">
                              ID: {effectiveChatId}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-gray-500 dark:text-slate-400">
                            <span>—</span>
                            <span>Немає</span>
                          </div>
                        )}
                      </td>
                    <td className="px-4 py-5 sm:px-6">
                      <div className="max-w-xs text-sm text-slate-700 dark:text-slate-300">
                        {client.address || (
                          <span className="text-slate-400 italic">Не вказано</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-5 sm:px-6">
                      {client.defaultPackage ? (
                        <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 px-3 py-1.5">
                          <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{client.defaultPackage}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-5 sm:px-6">
                      <div className="inline-flex items-center gap-2 rounded-lg bg-blue-100 dark:bg-blue-950/60 px-3 py-1.5">
                        <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{client._count.orders}</span>
                      </div>
                    </td>
                    <td className="px-4 py-5 sm:px-6">
                      <div className="max-w-xs">
                        {client.notes ? (
                          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
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
                  );
                })}
              </tbody>
            </table>
          </SyncedHorizontalScroll>
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
