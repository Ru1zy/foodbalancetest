import Link from "next/link";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import OrderActionButtons from "@/components/admin/OrderActionButtons";
import KitchenExport from "./KitchenExport";
import ArchiveOrdersButton from "@/components/admin/ArchiveOrdersButton";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { getOrderStatusClasses, getOrderStatusLabel } from "@/lib/order-status";

export const dynamic = "force-dynamic";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Kyiv",
  }).format(date);
}

function getOrderDaysCount(items: unknown) {
  if (!items || typeof items !== "object") {
    return 0;
  }

  const totalDays = Reflect.get(items, "totalDays");

  if (typeof totalDays === "number") {
    return totalDays;
  }

  const days = Reflect.get(items, "days");

  return Array.isArray(days) ? days.length : 0;
}

function formatDaysLabel(daysCount: number) {
  if (daysCount === 1) {
    return "1 день";
  }

  if (daysCount >= 2 && daysCount <= 4) {
    return `${daysCount} дні`;
  }

  return `${daysCount} днів`;
}

function getOrderAddressLabel(order: {
  deliveryAddress: string | null;
  user: {
    address: string | null;
  };
}) {
  return order.deliveryAddress || order.user.address || "Не вказано";
}

async function parseOrderMenuDetails(items: unknown, orderId: string): Promise<string | null> {
  if (!items || typeof items !== "object") {
    return null;
  }

  const days = Reflect.get(items, "days");
  if (!Array.isArray(days) || days.length === 0) {
    return null;
  }

  const CATEGORY_LABELS: Record<string, string> = {
    breakfast: "Сніданок",
    lunch: "Обід",
    dinner: "Вечеря",
    snack: "Перекус",
    extra: "Додатково",
  };

  // Fetch menu items for all dayIds in this order
  const dayIds = days.map((day: any) => day.dayId).filter(Boolean);

  if (dayIds.length === 0) {
    return null;
  }

  const menuItems = await prisma.menu.findMany({
    where: {
      id: {
        in: dayIds,
      },
    },
    select: {
      id: true,
      dishes: true,
      dayOfWeek: true,
    },
  });

  const menuById = new Map(menuItems.map((item) => [item.id, item]));

  const details = days.map((day: any, index: number) => {
    const dayNum = index + 1;
    const selections = day.selections || {};
    const items = day.items || [];
    const menu = menuById.get(day.dayId);

    let dayDetails = `День ${dayNum}:\n`;

    // Handle regular package selections
    if (Object.keys(selections).length > 0 && menu) {
      const dishes = typeof menu.dishes === 'string' ? JSON.parse(menu.dishes) : menu.dishes;

      Object.entries(selections).forEach(([category, selectionIndex]) => {
        const label = CATEGORY_LABELS[category] || category;
        const categoryDishes = dishes[category];

        if (Array.isArray(categoryDishes) && categoryDishes[selectionIndex as number]) {
          const dish = categoryDishes[selectionIndex as number];
          const dishName = typeof dish === 'object' && dish !== null ? (dish.full || dish.short || dish.name) : dish;
          dayDetails += `  • ${label}: ${dishName}\n`;
        } else {
          dayDetails += `  • ${label}: вибір #${(selectionIndex as number) + 1}\n`;
        }
      });
    }

    // Handle individual package items
    if (items.length > 0) {
      items.forEach((item: any) => {
        dayDetails += `  • ${item.dishId}: x${item.quantity}\n`;
      });
    }

    return dayDetails;
  }).join('\n');

  return details || null;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return (
      <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-800 sm:px-6">
        <section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Доступ заборонено</h1>
          <p className="mt-3 text-sm text-gray-600">Увійдіть як адміністратор, щоб переглянути замовлення.</p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
          >
            Повернутися на головну
          </Link>
        </section>
      </main>
    );
  }

  // Get today's date in Kyiv timezone (YYYY-MM-DD format)
  const todayString = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kiev' });

  // Create Date objects for start and end of today in Kyiv timezone
  const todayStart = new Date(`${todayString}T00:00:00.000+03:00`);
  const todayEnd = new Date(`${todayString}T23:59:59.999+03:00`);

  const whereClause = searchParams.filter === 'today'
    ? {
        deliveryDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      }
    : {};

  const orders = await prisma.order.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          address: true,
          chatId: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Fetch menu details for all orders
  const ordersWithMenuDetails = await Promise.all(
    orders.map(async (order) => ({
      ...order,
      menuDetails: await parseOrderMenuDetails(order.items, order.id),
    }))
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-8 text-gray-800 sm:px-6">
      <section className="mx-auto w-full px-6">
        <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-white/80 backdrop-blur-sm p-6 shadow-xl ring-1 ring-slate-200/60 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700">
              <span>←</span> Повернутися до сайту
            </Link>
            <h1 className="mt-4 text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Замовлення
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Панель адміністратора для перегляду нових замовлень і оновлення статусів.
            </p>
          </div>
          <div className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-3 text-sm text-white shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-blue-100">👤</span>
              <span className="font-semibold">{adminUser.name}</span>
            </div>
          </div>
        </div>

        <KitchenExport />

        <div className="mb-6">
          <ArchiveOrdersButton />
        </div>

        <div className="overflow-hidden rounded-2xl bg-white/80 backdrop-blur-sm shadow-xl ring-1 ring-slate-200/60">
          {ordersWithMenuDetails.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-lg font-semibold text-slate-700">Замовлень поки немає</p>
              <p className="text-sm text-slate-500 mt-2">Нові замовлення з'являться тут</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-gradient-to-r from-slate-50 to-blue-50 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-4 sm:px-6 w-32">ID / Дата</th>
                    <th className="px-4 py-4 sm:px-6 w-40">Клієнт</th>
                    <th className="px-4 py-4 sm:px-6 w-48">Адреса</th>
                    <th className="px-4 py-4 sm:px-6 min-w-[300px]">Пакет</th>
                    <th className="px-4 py-4 sm:px-6 w-32">Оплата</th>
                    <th className="px-4 py-4 sm:px-6 w-40">Статус</th>
                    <th className="px-4 py-4 sm:px-6 w-48">Коментар</th>
                    <th className="sticky right-0 bg-gradient-to-r from-slate-50 to-blue-50 px-4 py-4 shadow-[-8px_0_20px_-5px_rgba(0,0,0,0.1)] sm:px-6 z-10 w-32">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ordersWithMenuDetails.map((order) => {
                    const daysCount = getOrderDaysCount(order.items);

                    return (
                      <tr key={order.id} className="hover:bg-blue-50/50 transition-colors duration-150 align-top">
                        <td className="px-4 py-5 sm:px-6 align-top">
                          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5">
                            <span className="font-mono text-xs font-bold text-slate-700">{order.id.slice(0, 8)}</span>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">{formatDateTime(order.createdAt)}</div>
                        </td>
                        <td className="px-4 py-5 sm:px-6 align-top">
                          <div className="flex items-center gap-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white font-bold text-sm">
                              {order.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900">{order.user.name}</div>
                              <div className="text-xs text-slate-500">{order.user.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 sm:px-6 align-top">
                          <div className="flex items-start gap-2">
                            <span className="text-slate-400 mt-0.5">📍</span>
                            <div className="text-sm text-slate-700 max-w-xs">{getOrderAddressLabel(order)}</div>
                          </div>
                        </td>
                        <td className="px-4 py-5 sm:px-6 align-top min-w-[300px]">
                          <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-100 px-3 py-1.5">
                              <span className="text-sm font-bold text-indigo-700">{order.packageType}</span>
                            </div>
                            <div className="text-xs text-slate-600">📅 {formatDaysLabel(daysCount)}</div>
                            <div className="text-xs text-slate-600">🍴 Прибори: {order.cutlery}</div>
                            {order.price && (
                              <div className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-2.5 py-1 text-sm font-bold text-green-700">
                                <span>💰</span>
                                <span>{order.price} ₴</span>
                              </div>
                            )}
                            {order.menuDetails && (
                              <details className="mt-3 group">
                                <summary className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                  <span className="group-open:rotate-90 transition-transform">▶</span>
                                  Деталі раціону
                                </summary>
                                <div className="mt-2 rounded-lg bg-slate-50 p-3 border border-slate-200">
                                  <pre className="whitespace-pre-wrap text-xs text-slate-600 font-mono leading-relaxed">
                                    {order.menuDetails}
                                  </pre>
                                </div>
                              </details>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-5 sm:px-6 align-top">
                          <div
                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-sm ${
                              order.isPaid
                                ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white"
                                : "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                            }`}
                          >
                            <span>{order.isPaid ? "✓" : "⏳"}</span>
                            <span>{order.isPaid ? "Оплачено" : "Очікує"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-5 sm:px-6 align-top">
                          <div className="space-y-3">
                            <div
                              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-sm ${getOrderStatusClasses(order.status)}`}
                            >
                              {getOrderStatusLabel(order.status)}
                            </div>
                            <OrderStatusSelect orderId={order.id} currentStatus={order.status} />
                          </div>
                        </td>
                        <td className="px-4 py-5 sm:px-6 align-top">
                          <div className="max-w-xs">
                            {order.notes ? (
                              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                                <div className="flex items-start gap-2">
                                  <span className="text-amber-500 mt-0.5">💬</span>
                                  <span>{order.notes}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Немає коментаря</span>
                            )}
                          </div>
                        </td>
                        <td className="sticky right-0 bg-white/95 backdrop-blur-sm px-4 py-5 shadow-[-8px_0_20px_-5px_rgba(0,0,0,0.1)] sm:px-6 z-10">
                          <OrderActionButtons
                            orderId={order.id}
                            isPaid={order.isPaid}
                            hasChatId={!!order.user.chatId}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
