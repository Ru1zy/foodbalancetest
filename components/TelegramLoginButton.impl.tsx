"use client";

import { useEffect, useRef, useState } from "react";
import { useOrderStore } from "@/src/store/orderStore";

type TelegramWidgetUser = {
  auth_date?: number;
  first_name?: string;
  hash?: string;
  id: number;
  last_name?: string;
  photo_url?: string;
  username?: string;
};

type TelegramWidgetAuthResponse = {
  ok: boolean;
  user?: {
    address?: string;
    chatId?: string;
    cutlery?: number;
    name?: string;
    notes?: string;
    phone?: string;
    userId?: string;
    username?: string;
  };
};

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME;

export default function TelegramLoginButton() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const setCustomerProfile = useOrderStore((state) => state.setCustomerProfile);
  const [error, setError] = useState<string | null>(null);
  const configError = !BOT_USERNAME
    ? "NEXT_PUBLIC_BOT_USERNAME не заданий. Telegram Login Widget не може бути показаний."
    : null;

  useEffect(() => {
    if (!BOT_USERNAME) {
      return;
    }

    const container = containerRef.current;

    if (!container) {
      return;
    }

    container.innerHTML = "";

    window.onTelegramAuth = async (user: TelegramWidgetUser) => {
      try {
        const response = await fetch("/api/auth/telegram-widget", {
          body: JSON.stringify(user),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          setError("Не вдалося авторизуватися через Telegram.");
          return;
        }

        const result = (await response.json()) as TelegramWidgetAuthResponse;

        if (!result.ok || !result.user) {
          setError("Не вдалося отримати профіль Telegram.");
          return;
        }

        setCustomerProfile({
          address: result.user.address ?? "",
          chatId: result.user.chatId ?? "",
          cutlery: result.user.cutlery ?? 0,
          isAuthenticated: true,
          name: result.user.name ?? "",
          notes: result.user.notes ?? "",
          phone: result.user.phone ?? "",
          userId: result.user.userId ?? "",
          username: result.user.username ?? "",
        });
      } catch (requestError) {
        console.error("Telegram widget auth request failed", requestError);
        setError("Сталася помилка під час авторизації через Telegram.");
      }
    };

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
      delete window.onTelegramAuth;
    };
  }, [setCustomerProfile]);

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
      <h2 className="text-lg font-semibold text-gray-900">Увійти через Telegram за бажанням</h2>
      <p className="mt-2 text-sm text-gray-600">
        Це потрібно лише для швидкого автозаповнення профілю. Замовлення можна оформити і без Telegram.
      </p>
      {(configError || error) && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {configError || error}
        </div>
      )}
      <div ref={containerRef} className="mt-4 min-h-12" />
    </div>
  );
}
