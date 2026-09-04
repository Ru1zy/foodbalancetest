"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrderStore } from "@/lib/orderStore";
import { sanitizeTelegramPhone } from "@/lib/telegram-phone";

const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || "fooddevtestbot";
const SESSION_STORAGE_KEY = "fb_telegram_auth_token";

type Props = {
  onSuccess?: () => void;
};

export default function TelegramDeepLinkAuth({ onSuccess }: Props) {
  const router = useRouter();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const setCustomerProfile = useOrderStore((state) => state.setCustomerProfile);

  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Restore active polling if user refreshed or returned to the tab
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedToken = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (savedToken) {
          setAuthToken(savedToken);
          setIsPolling(true);
        }
      } catch (e) {
        console.warn("Could not read sessionStorage:", e);
      }
    }
  }, []);

  const handleReset = useCallback(() => {
    setIsPolling(false);
    setAuthToken(null);
    setError(null);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch (e) {
        console.warn("Could not clear sessionStorage:", e);
      }
    }
    abortControllerRef.current?.abort();
    isFetchingRef.current = false;
  }, []);

  const pollStatus = useCallback(
    async (tokenToCheck: string) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/auth/telegram-deeplink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check", token: tokenToCheck }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === "confirmed") {
          setIsPolling(false);
          setAuthToken(null);
          setError(null);
          if (typeof window !== "undefined") {
            try {
              sessionStorage.removeItem(SESSION_STORAGE_KEY);
            } catch (e) {
              console.warn("Could not clear sessionStorage:", e);
            }
          }

          setCustomerProfile({
            address: data.user.address || "",
            chatId: data.user.chatId || "",
            name: data.user.name || "",
            phone: sanitizeTelegramPhone(data.user.phone),
            userId: data.user.userId || "",
            isAuthenticated: true,
            cutlery: 0,
            notes: "",
            username: "",
          });

          router.refresh();
          if (onSuccess) onSuccess();
        } else if (data.status === "expired") {
          handleReset();
          setError("Термін дії посилання вичерпано. Будь ласка, спробуйте знову.");
        } else if (data.status === "error") {
          handleReset();
          setError("Помилка при перевірці статусу. Спробуйте ще раз.");
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Telegram polling error:", err);
      } finally {
        isFetchingRef.current = false;
      }
    },
    [handleReset, onSuccess, router, setCustomerProfile]
  );

  useEffect(() => {
    if (!authToken || !isPolling) return;

    // Regular interval check
    const pollInterval = setInterval(() => {
      pollStatus(authToken);
    }, 2000);

    // Instant check when user switches back from Telegram to this browser tab
    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        pollStatus(authToken);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    // 2-minute safety timeout
    const timeout = setTimeout(() => {
      if (isPolling) {
        handleReset();
        setError("Час очікування вичерпано. Будь ласка, спробуйте знову.");
      }
    }, 2 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      abortControllerRef.current?.abort();
      isFetchingRef.current = false;
    };
  }, [authToken, isPolling, pollStatus, handleReset]);

  const handleLogin = async () => {
    const isMobile =
      typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

    // Synchronously open blank window on desktop inside user click gesture so browser popup blockers NEVER block it!
    let newTab: Window | null = null;
    if (!isMobile) {
      newTab = window.open("about:blank", "_blank");
    }

    try {
      setIsLoadingAuth(true);
      setError(null);

      const response = await fetch("/api/auth/telegram-deeplink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });

      if (!response.ok) throw new Error("Failed to generate token");

      const data = await response.json();
      setAuthToken(data.token);
      setIsPolling(true);

      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, data.token);
        } catch (e) {
          console.warn("Could not save to sessionStorage:", e);
        }
      }

      const telegramUrl = `https://t.me/${BOT_USERNAME}?start=${data.token}`;

      // CRITICAL: NEVER navigate the main FoodBalance window via window.location.href!
      // The main window MUST stay active and keep polling for auth confirmation!
      if (newTab && !newTab.closed) {
        newTab.location.href = telegramUrl;
      } else {
        // Fallback for mobile or if desktop blocked initial window.open:
        // Try opening in a new tab; if blocked, the UI button below is ready for a direct click.
        window.open(telegramUrl, "_blank");
      }
    } catch (err) {
      if (newTab && !newTab.closed) {
        newTab.close();
      }
      console.error("Login error:", err);
      setError("Не вдалося ініціювати вхід. Спробуйте ще раз.");
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const telegramBotUrl = authToken ? `https://t.me/${BOT_USERNAME}?start=${authToken}` : "#";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Вхід до FoodBalance</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Оберіть зручний спосіб авторизації
        </p>
      </div>

      {isPolling && authToken ? (
        <div className="space-y-4">
          <a
            href={telegramBotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 w-full text-center bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md active:scale-95 text-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.14.121.099.155.232.171.326.016.093.036.306.02.472z" />
            </svg>
            Відкрити Telegram бота
          </a>

          <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/30 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-bold text-blue-900 dark:text-blue-200">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
              Очікуємо підтвердження...
            </div>
            <p className="mt-2 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
              1. Перейдіть у Telegram та натисніть кнопку <b>«Підтвердити вхід»</b>.<br />
              2. Ця сторінка автоматично оновить статус і увійде в акаунт.
            </p>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="w-full text-center text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-2 transition"
          >
            ← Скасувати / Обрати інший спосіб
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Google Auth Button */}
          <a
            href="/api/auth/google/login"
            className="flex items-center justify-center gap-3 w-full px-6 py-3.5 bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-700 rounded-xl hover:border-gray-300 dark:border-slate-600 hover:shadow-md transition-all duration-200 group"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-semibold text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:text-slate-100">
              Увійти через Google
            </span>
          </a>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white dark:bg-slate-900 px-2 text-gray-400 uppercase tracking-wider font-medium">або</span>
            </div>
          </div>

          {/* Telegram Auth Button */}
          <button
            type="button"
            onClick={handleLogin}
            disabled={isLoadingAuth}
            className="flex items-center justify-center gap-3 w-full px-6 py-3.5 bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.14.121.099.155.232.171.326.016.093.036.306.02.472z" />
            </svg>
            <span>{isLoadingAuth ? "З'єднання..." : "Увійти через Telegram"}</span>
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800 break-words overflow-hidden">
          ⚠️ {error}
        </div>
      )}

      <p className="text-center text-[10px] text-gray-400 uppercase tracking-widest font-medium">
        Безпечна авторизація
      </p>
    </div>
  );
}
