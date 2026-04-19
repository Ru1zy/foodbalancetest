import Link from "next/link";
import prisma from "@/lib/prisma";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import ClientsPageClient from "./ClientsPageClient";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return (
      <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-800 sm:px-6">
        <section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Доступ заборонено</h1>
          <p className="mt-3 text-sm text-gray-600">
            Увійдіть як адміністратор, щоб переглянути клієнтів.
          </p>
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

  const clients = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      chatId: true,
      address: true,
      notes: true,
      defaultPackage: true,
      _count: {
        select: {
          orders: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-8 text-gray-800 sm:px-6">
      <section className="mx-auto w-full px-6">
        <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-white/80 backdrop-blur-sm p-6 shadow-xl ring-1 ring-slate-200/60 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              <span>←</span> До замовлень
            </Link>
            <h1 className="mt-4 text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Клієнти (CRM)
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              База клієнтів з історією замовлень та контактною інформацією.
            </p>
          </div>
          <div className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-3 text-sm text-white shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-blue-100">👤</span>
              <span className="font-semibold">{adminUser.name}</span>
            </div>
          </div>
        </div>

        <ClientsPageClient clients={clients} />
      </section>
    </main>
  );
}
