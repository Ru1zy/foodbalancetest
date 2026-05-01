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
        // Don't stop polling on network errors, just wait for next tick
      }
    }, 2000);

    // Stop polling after 2 minutes (standard Telegram UX)
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

      const botUrl = `https://t.me/${BOT_USERNAME}?start=${data.token}`;
      window.open(botUrl, "_blank");
    } catch (err) {
      console.error("Login error:", err);
      setError("Не вдалося ініціювати вхід. Перевірте з'єднання.");
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

      {isPolling && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 animate-pulse">
          ⏳ Очікуємо підтвердження в Telegram...
          <p className="mt-1 text-xs opacity-80">Перейдіть у бот і натисніть &quot;Підтвердити вхід&quot;</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          ⚠️ {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleLogin}
        disabled={isPolling}
        className={`w-full rounded-2xl px-6 py-4 text-base font-bold shadow-sm transition-all active:scale-95 ${
          isPolling
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md"
        }`}
      >
        {isPolling ? "Очікування..." : "Увійти через Telegram"}
      </button>

      {!isPolling && (
        <p className="text-center text-[10px] text-gray-400 uppercase tracking-widest font-bold">
          Безпечний вхід через @{BOT_USERNAME}
        </p>
      )}
    </div>
  );
}
