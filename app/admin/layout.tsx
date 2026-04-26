import Link from "next/link";
import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import AdminLayoutClient from "./AdminLayoutClient";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    return (
      <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-800 sm:px-6">
        <section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Доступ заборонено</h1>
          <p className="mt-3 text-sm text-gray-600">
            Увійдіть як адміністратор, щоб отримати доступ до панелі управління.
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

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
