import { cookies } from "next/headers";
import Link from "next/link";
import TelegramAuthButton from "./TelegramAuthButton";
import LogoutButton from "./LogoutButton";

export default async function Header() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const isAuthenticated = !!token;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/20 glass shadow-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xl transition-transform group-hover:scale-110 group-hover:rotate-6 overflow-hidden">
                <img src="/foodbalancelogo.png" alt="FoodBalance" className="h-full w-full object-cover" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                FoodBalance
              </span>
              <div className="text-xs text-slate-500 font-medium">Здорове харчування</div>
            </div>
          </Link>

          <nav className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-white/50 hover:scale-105"
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
