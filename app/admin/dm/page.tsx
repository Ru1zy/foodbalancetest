import Link from "next/link";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import DirectMessageForm from "./DirectMessageForm";

export const dynamic = "force-dynamic";

export default async function AdminDirectMessagesPage() {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return (
      <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-800 sm:px-6">
        <section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Доступ заборонено</h1>
          <p className="mt-3 text-sm text-gray-600">Увійдіть як адміністратор, щоб відправляти повідомлення.</p>
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

  const users = await prisma.user.findMany({
    where: {
      chatId: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      phone: true,
      chatId: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-800 sm:px-6">
      <section className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div>
            <Link href="/admin/orders" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
              Повернутися до замовлень
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">Особисті повідомлення</h1>
            <p className="mt-2 text-sm text-gray-600">
              Відправте персональне повідомлення конкретному користувачу через Telegram.
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Авторизовано як <span className="font-semibold text-gray-900">{adminUser.name}</span>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
          {users.length === 0 ? (
            <div className="text-center text-sm text-gray-500">
              Немає користувачів з Telegram ID для відправки повідомлень.
            </div>
          ) : (
            <DirectMessageForm users={users} />
          )}
        </div>
      </section>
    </main>
  );
}
