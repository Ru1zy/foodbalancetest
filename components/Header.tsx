import { cookies } from "next/headers";
import Link from "next/link";
import TelegramLoginButton from "./TelegramLoginButton.impl";

export default async function Header() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const isAuthenticated = !!token;

  return (
    <header className="flex items-center justify-between w-full p-4 border-b bg-white">
      <div className="flex items-center">
        <Link href="/" className="text-xl font-bold text-gray-900">
          FoodBalance
        </Link>
      </div>
      <nav className="flex items-center space-x-4">
        {isAuthenticated ? (
          <>
            <Link
              href="/profile"
              className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
            >
              Профіль
            </Link>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700"
              >
                Вийти
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-end text-right gap-1">
            <TelegramLoginButton />
          </div>
        )}
      </nav>
    </header>
  );
}