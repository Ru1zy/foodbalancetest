import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import Link from "next/link";
import MegaphoneClient from "./MegaphoneClient";

export default async function MegaphonePage() {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return (
      <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-800 sm:px-6">
        <section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Доступ заборонено</h1>
          <p className="mt-3 text-sm text-gray-600">Увійдіть як адміністратор.</p>
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

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-800 sm:px-6">
      <section className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
          <div>
            <Link href="/admin/orders" className="text-sm font-semibold text-blue-600 transition hover:text-blue-700">
              ← Назад до замовлень
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">📢 Мегафон</h1>
            <p className="mt-2 text-sm text-gray-600">
              Масова розсилка повідомлень всім користувачам з Telegram ID
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Авторизовано як <span className="font-semibold text-gray-900">{adminUser.name}</span>
          </div>
        </div>

        <MegaphoneClient />
      </section>
    </main>
  );
}
