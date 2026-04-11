import { cookies } from "next/headers";
import Link from "next/link";
import TelegramAuthButton from "./TelegramAuthButton";
import LogoutButton from "./LogoutButton";

export default async function Header() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const isAuthenticated = !!token;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-xl shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 transition-transform group-hover:scale-110">
                <span className="text-xl">🍽️</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                FoodBalance
              </span>
            </Link>
          </div>
          <nav className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100 hover:text-slate-900"
                >
                  <span>👤</span>
                  <span className="hidden sm:inline">Профіль</span>
                </Link>
                <LogoutButton />
              </>
            ) : (
              <TelegramAuthButton />
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
