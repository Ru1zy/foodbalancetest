import Link from "next/link";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import OrderActionButtons from "@/components/admin/OrderActionButtons";
import KitchenExport from "./KitchenExport";
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
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-800 sm:px-6">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div>
            <Link href="/" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
              Повернутися до сайту
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">Замовлення</h1>
            <p className="mt-2 text-sm text-gray-600">
              Панель адміністратора для перегляду нових замовлень і оновлення статусів.
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Авторизовано як <span className="font-semibold text-gray-900">{adminUser.name}</span>
          </div>
        </div>

        <KitchenExport />

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-200">
          {ordersWithMenuDetails.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">Замовлень поки немає.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  <tr>
                    <th className="px-4 py-4 sm:px-6">ID / Дата</th>
                    <th className="px-4 py-4 sm:px-6">Клієнт</th>
                    <th className="px-4 py-4 sm:px-6">Адреса</th>
                    <th className="px-4 py-4 sm:px-6">Пакет</th>
                    <th className="px-4 py-4 sm:px-6">Оплата</th>
                    <th className="px-4 py-4 sm:px-6">Статус</th>
                    <th className="px-4 py-4 sm:px-6">Коментар</th>
                    <th className="sticky right-0 bg-gray-50 px-4 py-4 shadow-[-5px_0_15px_-3px_rgba(0,0,0,0.05)] sm:px-6 z-10">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersWithMenuDetails.map((order) => {
                    const daysCount = getOrderDaysCount(order.items);

                    return (
                      <tr key={order.id} className="border-t border-gray-100 align-top">
                        <td className="px-4 py-5 sm:px-6">
                          <div className="font-mono text-sm font-semibold text-gray-900">{order.id.slice(0, 8)}</div>
                          <div className="mt-2 text-sm text-gray-600">{formatDateTime(order.createdAt)}</div>
                        </td>
                        <td className="px-4 py-5 sm:px-6">
                          <div className="text-sm font-semibold text-gray-900">{order.user.name}</div>
                          <div className="mt-2 text-sm text-gray-600">{order.user.phone}</div>
                        </td>
                        <td className="px-4 py-5 sm:px-6 text-sm text-gray-700">
                          <div className="font-medium text-gray-900">Доставка</div>
                          <div className="mt-1">{getOrderAddressLabel(order)}</div>
                        </td>
                        <td className="px-4 py-5 sm:px-6">
                          <div className="text-sm font-semibold text-gray-900">{order.packageType}</div>
                          <div className="mt-2 text-sm text-gray-600">{formatDaysLabel(daysCount)}</div>
                          <div className="mt-2 text-sm text-gray-600">Прибори: {order.cutlery}</div>
                          {order.price && (
                            <div className="mt-2 text-sm font-semibold text-gray-900">{order.price} ₴</div>
                          )}
                          {order.menuDetails && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">
                                Деталі раціону
                              </summary>
                              <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-600 font-mono">
                                {order.menuDetails}
                              </pre>
                            </details>
                          )}
                        </td>
                        <td className="px-4 py-5 sm:px-6">
                          <div
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                              order.isPaid
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {order.isPaid ? "Оплачено" : "Не оплачено"}
                          </div>
                        </td>
                        <td className="px-4 py-5 sm:px-6">
                          <div
                            className={`mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusClasses(order.status)}`}
                          >
                            {getOrderStatusLabel(order.status)}
                          </div>
                          <OrderStatusSelect orderId={order.id} currentStatus={order.status} />
                        </td>
                        <td className="px-4 py-5 text-sm text-gray-700 sm:px-6">
                          {order.notes || "Немає коментаря"}
                        </td>
                        <td className="sticky right-0 bg-white px-4 py-5 shadow-[-5px_0_15px_-3px_rgba(0,0,0,0.05)] sm:px-6 z-10">
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
