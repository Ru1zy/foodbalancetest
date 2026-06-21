"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

const navLinks = [
  { href: "/admin/orders", label: "Замовлення", icon: "📦" },
  { href: "/admin/today", label: "Сьогодні", icon: "📅" },
  { href: "/admin/clients", label: "Клієнти (CRM)", icon: "👥" },
  { href: "/admin/menu", label: "Меню", icon: "🍽️" },
  { href: "/admin/tariffs", label: "Тарифи", icon: "💰" },
  { href: "/admin/settings/sheets", label: "Таблиці", icon: "📊" },
];

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[100dvh] bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden w-72 border-r border-gray-200 bg-white lg:block shadow-sm">
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-200 p-6 bg-gray-900">
            <h1 className="text-2xl font-bold text-white tracking-tight">🎯 Адмін-панель</h1>
            <p className="text-gray-300 text-sm mt-1">Керування системою</p>
          </div>
          <nav className="flex-1 space-y-2 p-4">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href.includes('?') && pathname.startsWith(link.href.split('?')[0]));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-gray-900 text-white shadow-sm scale-105"
                      : "text-gray-700 hover:bg-gray-100 hover:scale-102"
                  }`}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span>{link.label}</span>
                  {isActive && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-white"></span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Mobile Topbar */}
      <div className="fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-white shadow-sm lg:hidden">
        <div className="flex items-center justify-between p-4 bg-gray-900">
          <h1 className="text-lg font-bold text-white">🎯 Адмін-панель</h1>
          <LogoutButton />
        </div>
        <nav className="flex overflow-x-auto border-t border-gray-200 bg-white">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href.includes('?') && pathname.startsWith(link.href.split('?')[0]));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex-shrink-0 flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
                  isActive
                    ? "border-blue-600 text-blue-600 bg-blue-50"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <span>{link.icon}</span>
                <span className="hidden sm:inline">{link.label}</span>
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
