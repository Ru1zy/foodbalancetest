import Link from "next/link";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { getDeliveryMethodLabel, type DeliveryMethod } from "@/lib/checkout";
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
  deliveryMethod: DeliveryMethod;
  user: {
    address: string | null;
  };
}) {
  if (order.deliveryMethod === "pickup") {
    return "Самовивіз";
  }

  return order.deliveryAddress || order.user.address || "Не вказано";
}

export default async function AdminOrdersPage() {
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

  const orders = await prisma.order.findMany({
    include: {
      user: {
        select: {
          address: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

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

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-200">
          {orders.length === 0 ? (
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
                    <th className="px-4 py-4 sm:px-6">Статус</th>
                    <th className="px-4 py-4 sm:px-6">Коментар</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
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
                          <div className="font-medium text-gray-900">
                            {getDeliveryMethodLabel(order.deliveryMethod as DeliveryMethod)}
                          </div>
                          {order.user.address || "Не вказано"}
                        </td>
                        <td className="px-4 py-5 sm:px-6">
                          <div className="text-sm font-semibold text-gray-900">{order.packageType}</div>
                          <div className="mt-2 text-sm text-gray-600">{formatDaysLabel(daysCount)}</div>
                          <div className="mt-2 text-sm text-gray-600">Прибори: {order.cutlery}</div>
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
