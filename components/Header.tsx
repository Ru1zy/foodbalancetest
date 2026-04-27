import { cookies } from "next/headers";
import Link from "next/link";
import TelegramAuthButton from "./TelegramAuthButton";
import LogoutButton from "./LogoutButton";

export default async function Header() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const isAuthenticated = !!token;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl drop-shadow-sm">
                <img src="/foodbalancelogo.png" alt="FoodBalance" className="h-full w-full object-cover mix-blend-multiply" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-black text-slate-700">
                Food Balance
              </span>
              <div className="text-xs text-gray-500 font-medium">Здорове харчування</div>
            </div>
          </Link>

          <nav className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-gray-900 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
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
