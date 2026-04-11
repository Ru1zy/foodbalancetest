"use client";

import { useState, useEffect } from "react";
import { useOrderStore } from "@/lib/orderStore";

const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || "fooddevtestbot";

type Props = {
  onSuccess?: () => void;
};

export default function TelegramDeepLinkAuth({ onSuccess }: Props) {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const setCustomerProfile = useOrderStore((state) => state.setCustomerProfile);

  useEffect(() => {
    if (!authToken || !isPolling) return;

    const pollInterval = setInterval(async () => {
      try {
        console.log("Polling for token:", authToken);
        const response = await fetch("/api/auth/telegram-deeplink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check", token: authToken }),
        });

        const data = await response.json();
        console.log("Poll response:", data);

        if (data.status === "confirmed") {
          console.log("Auth confirmed! Redirecting...");
          setIsPolling(false);

          if (onSuccess) {
            onSuccess();
          }

          if (onSuccess) {
            onSuccess();
          }

          // Parse address if exists
          const rawAddress = data.user.address || "";
          let street = rawAddress;
          let house = "";
          let apartment = "";
          let entrance = "";
          let intercom = "";

          if (rawAddress) {
            const streetMatch = rawAddress.match(/Вул\.\s*([^,]+)/);
            const houseMatch = rawAddress.match(/буд\.\s*([^,]+)/);
            const apartmentMatch = rawAddress.match(/кв\.\s*([^,]+)/);
            const entranceMatch = rawAddress.match(/під'їзд\s*([^,]+)/);
            const intercomMatch = rawAddress.match(/код\s*([^,]+)/);

            if (streetMatch || houseMatch) {
              street = streetMatch?.[1]?.trim() || "";
              house = houseMatch?.[1]?.trim() || "";
              apartment = apartmentMatch?.[1]?.trim() || "";
              entrance = entranceMatch?.[1]?.trim() || "";
              intercom = intercomMatch?.[1]?.trim() || "";
            }
          }

          setCustomerProfile({
            street,
            house,
            apartment,
            entrance,
            intercom,
            chatId: data.user.chatId || "",
            name: data.user.name || "",
            phone: data.user.phone || "",
            userId: data.user.userId || "",
            isAuthenticated: true,
            cutlery: 0,
            notes: "",
            username: "",
          });

          window.location.href = "/profile";
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);

    // Stop polling after 5 minutes
    const timeout = setTimeout(() => {
      setIsPolling(false);
      setAuthToken(null);
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [authToken, isPolling, setCustomerProfile]);

  const handleLogin = async () => {
    try {
      console.log("Generating auth token...");
      const response = await fetch("/api/auth/telegram-deeplink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });

      const data = await response.json();
      const token = data.token;
      console.log("Generated token:", token);

      setAuthToken(token);
      setIsPolling(true);

      // Open bot with deep link
      const botUrl = `https://t.me/${BOT_USERNAME}?start=${token}`;
      console.log("Opening bot URL:", botUrl);
      window.open(botUrl, "_blank");
    } catch (error) {
      console.error("Failed to generate auth token:", error);
      alert("Помилка при генерації токену авторизації");
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Увійти через Telegram</h2>
      <p className="text-xs text-gray-500 mb-4">
        Натисніть кнопку нижче, щоб відкрити бота в Telegram і підтвердити вхід.
      </p>

      {isPolling && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          ⏳ Очікуємо підтвердження в Telegram... Натисніть кнопку в боті.
        </div>
      )}

      <button
        type="button"
        onClick={handleLogin}
        disabled={isPolling}
        className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
          isPolling
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {isPolling ? "Очікування підтвердження..." : "Увійти через Telegram"}
      </button>

      <p className="mt-3 text-xs text-gray-500">
        Відкриється бот @{BOT_USERNAME} в Telegram. Підтвердіть вхід натиснувши кнопку.
      </p>
    </div>
  );
}
