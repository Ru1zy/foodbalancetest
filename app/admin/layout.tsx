"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

const navLinks = [
  { href: "/admin/orders", label: "Замовлення" },
  { href: "/admin/orders?filter=today", label: "Сьогоднішні замовлення" },
  { href: "/admin/menu", label: "Меню та Тарифи" },
  { href: "/admin/tariffs", label: "Тарифи" },
  { href: "/admin/broadcast", label: "Розсилка (Мегафон)" },
  { href: "/admin/dm", label: "Особисті повідомлення" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 border-r border-gray-200 bg-white lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-200 p-6">
            <h1 className="text-xl font-bold text-gray-900">Адмін-панель</h1>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block rounded-lg px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-gray-200 p-4">
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Mobile Topbar */}
      <div className="fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-white lg:hidden">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-lg font-bold text-gray-900">Адмін-панель</h1>
          <LogoutButton />
        </div>
        <nav className="flex overflow-x-auto border-t border-gray-100">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex-shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <main className="flex-1 pt-[120px] lg:pt-0">
        {children}
      </main>
    </div>
  );
}
