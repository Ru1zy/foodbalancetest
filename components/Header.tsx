import { cookies } from "next/headers";
import Link from "next/link";
import TelegramAuthButton from "./TelegramAuthButton";
import LogoutButton from "./LogoutButton";
import Logo from "./Logo";

export default async function Header() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const isAuthenticated = !!token;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <Logo />

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
