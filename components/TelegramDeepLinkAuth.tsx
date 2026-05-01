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
            deliveryTime: "",
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
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Увійти через Telegram</h2>
        <p className="text-xs text-gray-500">
          Ми автоматично підтягнемо ваше ім&apos;я та історію замовлень.
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
        <button
          type="button"
          onClick={handleLogin}
          className="w-full rounded-2xl bg-emerald-600 px-6 py-4 text-base font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
        >
          Увійти через Telegram
        </button>
      )}

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          ⚠️ {error}
        </div>
      )}

      <p className="text-center text-[10px] text-gray-400 uppercase tracking-widest font-bold">
        Безпечний вхід через @{BOT_USERNAME}
      </p>
    </div>
  );
}
