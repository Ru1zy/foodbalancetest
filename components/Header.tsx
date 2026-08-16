import { cookies } from "next/headers";
import Link from "next/link";
import TelegramAuthButton from "./TelegramAuthButton";
import LogoutButton from "./LogoutButton";
import Logo from "./Logo";
import prisma from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/auth-token";
import { ThemeToggle } from "./ThemeToggle";

export default async function Header() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  let isAuthenticated = false;
  let needsOnboarding = false;

  // Check if user needs onboarding (has google_ placeholder phone)
  if (token) {
    let userId: string | null = null;
    try {
      userId = await verifyAuthToken(token);
    } catch {
      // Invalid token, ignore
    }

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      });

      if (user) {
        isAuthenticated = true;
        needsOnboarding = user.phone.startsWith("google_");
      }
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <Logo />

          <nav className="flex items-center gap-4">
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                {needsOnboarding ? (
                  // User needs onboarding - show only logout
                  <div className="flex items-center gap-3">
                    <Link
                      href="/onboarding"
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      Завершіть реєстрацію
                    </Link>
                    <LogoutButton />
                  </div>
                ) : (
                  // Normal authenticated user
                  <>
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-gray-900 dark:text-slate-100 border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:bg-slate-950"
                    >
                      <span>👤</span>
                      <span className="hidden sm:inline">Профіль</span>
                    </Link>
                    <LogoutButton />
                  </>
                )}
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
