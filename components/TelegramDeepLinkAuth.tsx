"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrderStore } from "@/lib/orderStore";
import { sanitizeTelegramPhone } from "@/lib/telegram-phone";

const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || "fooddevtestbot";

type Props = {
  onSuccess?: () => void;
};

export default function TelegramDeepLinkAuth({ onSuccess }: Props) {
  const router = useRouter();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const setCustomerProfile = useOrderStore((state) => state.setCustomerProfile);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authToken || !isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/auth/telegram-deeplink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check", token: authToken }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === "confirmed") {
          setIsPolling(false);
          setError(null);

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
          setIsPolling(false);
          setAuthToken(null);
          setError("Термін дії посилання вичерпано. Спробуйте ще раз.");
        } else if (data.status === "error") {
          setIsPolling(false);
          setError("Помилка при перевірці статусу. Спробуйте ще раз.");
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    const timeout = setTimeout(() => {
      if (isPolling) {
        setIsPolling(false);
        setAuthToken(null);
        setError("Час очікування вичерпано. Будь ласка, спробуйте знову.");
      }
    }, 2 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [authToken, isPolling, setCustomerProfile, router, onSuccess]);

  const handleLogin = async () => {
    try {
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

      // Try automatic open in new tab
      window.open(`https://t.me/${BOT_USERNAME}?start=${data.token}`, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Login error:", err);
      setError("Не вдалося ініціювати вхід. Спробуйте ще раз.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Вхід до FoodBalance</h2>
        <p className="mt-1 text-sm text-gray-500">
          Оберіть зручний спосіб авторизації
        </p>
      </div>

      {isPolling && authToken ? (
        <div className="space-y-4">
          <a
            href={`https://t.me/${BOT_USERNAME}?start=${authToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-md active:scale-95"
          >
            Відкрити Telegram бота
          </a>

          <div className="text-center text-sm text-blue-800 animate-pulse font-medium bg-blue-50 py-3 rounded-xl border border-blue-100">
            ⏳ Очікуємо підтвердження...
            <p className="mt-1 text-[10px] opacity-70">Натисніть кнопку в боті після переходу</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Google Auth Button */}
          <a
            href="/api/auth/google/login"
            className="flex items-center justify-center gap-3 w-full px-6 py-3.5 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
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
            <span className="font-semibold text-gray-700 group-hover:text-gray-900">
              Увійти через Google
            </span>
          </a>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-gray-400 uppercase tracking-wider font-medium">або</span>
            </div>
          </div>

          {/* Telegram Auth Button */}
          <button
            type="button"
            onClick={handleLogin}
            className="flex items-center justify-center gap-3 w-full px-6 py-3.5 bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold rounded-xl transition-all shadow-sm active:scale-95"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.14.121.099.155.232.171.326.016.093.036.306.02.472z"/>
            </svg>
            <span>Увійти через Telegram</span>
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          ⚠️ {error}
        </div>
      )}

      <p className="text-center text-[10px] text-gray-400 uppercase tracking-widest font-medium">
        Безпечна авторизація
      </p>
    </div>
  );
}
