"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrderStore } from "@/lib/orderStore";

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
  const [showHelper, setShowHelper] = useState(false);
  const configError = !BOT_USERNAME
    ? "NEXT_PUBLIC_BOT_USERNAME не заданий. Telegram Login Widget не може бути показаний."
    : null;
  const router = useRouter();

  const handleBotRedirect = () => {
    // Open bot with start parameter containing return URL
    const returnUrl = encodeURIComponent(window.location.href);
    const botUrl = `https://t.me/${BOT_USERNAME}?start=auth_${returnUrl}`;
    window.open(botUrl, '_blank');
  };

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
      console.log("Telegram widget callback triggered with user:", user);
      try {
        const response = await fetch("/api/auth/telegram-widget", {
          body: JSON.stringify(user),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        console.log("Server response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Server error:", errorText);
          setError("Не вдалося авторизуватися через Telegram.");
          return;
        }

        const result = (await response.json()) as TelegramWidgetAuthResponse;

        console.log('TELEGRAM AUTH PAYLOAD:', result);

        if (!result.ok || !result.user) {
          setError("Не вдалося отримати профіль Telegram.");
          return;
        }

        // Parse address into 5 fields
        const rawAddress = result.user.address ?? "";
        let street = "";
        let house = "";
        let apartment = "";
        let entrance = "";
        let intercom = "";

        if (rawAddress) {
          // Try to parse format: "Вул. [street], буд. [house], кв. [apartment], під'їзд [entrance], код [intercom]"
          const streetMatch = rawAddress.match(/Вул\.\s*([^,]+)/);
          const houseMatch = rawAddress.match(/буд\.\s*([^,]+)/);
          const apartmentMatch = rawAddress.match(/кв\.\s*([^,]+)/);
          const entranceMatch = rawAddress.match(/під'їзд\s*([^,]+)/);
          const intercomMatch = rawAddress.match(/код\s*([^,]+)/);

          if (streetMatch || houseMatch) {
            // Structured format detected
            street = streetMatch?.[1]?.trim() ?? "";
            house = houseMatch?.[1]?.trim() ?? "";
            apartment = apartmentMatch?.[1]?.trim() ?? "";
            entrance = entranceMatch?.[1]?.trim() ?? "";
            intercom = intercomMatch?.[1]?.trim() ?? "";
          } else {
            // Fallback: put entire address in street field
            street = rawAddress;
          }
        }

        setCustomerProfile({
          street,
          house,
          apartment,
          entrance,
          intercom,
          chatId: result.user.chatId ?? "",
          cutlery: result.user.cutlery ?? 0,
          isAuthenticated: true,
          name: result.user.name ?? "",
          notes: result.user.notes ?? "",
          phone: result.user.phone ?? "",
          userId: result.user.userId ?? "",
          username: result.user.username ?? "",
        });

        // Hard reload to sync server-side header with new auth token
        window.location.href = "/profile";
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

    script.onload = () => {
      console.log("Telegram widget script loaded successfully");
    };

    script.onerror = () => {
      console.error("Failed to load Telegram widget script");
      setError("Не вдалося завантажити Telegram віджет. Перевірте з'єднання.");
    };

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
      delete window.onTelegramAuth;
    };
  }, [setCustomerProfile, router]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Увійти через Telegram за бажанням</h2>
      <p className="text-xs text-gray-500">
        Це потрібно лише для швидкого автозаповнення профілю. Замовлення можна оформити і без Telegram.
      </p>

      {!showHelper && (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <strong>Не працює кнопка нижче?</strong>{" "}
          <button
            type="button"
            onClick={() => setShowHelper(true)}
            className="underline font-semibold hover:text-blue-900"
          >
            Спробуйте альтернативний спосіб
          </button>
        </div>
      )}

      {showHelper && (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <p className="font-semibold mb-2">Авторизація через Telegram Mini App</p>
          <p className="mb-3">
            1. Відкрийте бота <strong>@{BOT_USERNAME}</strong> в Telegram<br/>
            2. Натисніть кнопку меню (☰) або відправте команду /start<br/>
            3. Відкрийте Mini App - авторизація відбудеться автоматично<br/>
            4. Поверніться на цю сторінку - ваш профіль буде збережено
          </p>
          <button
            type="button"
            onClick={handleBotRedirect}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            Відкрити @{BOT_USERNAME}
          </button>
          <button
            type="button"
            onClick={() => setShowHelper(false)}
            className="ml-3 text-sm text-gray-600 underline hover:text-gray-900"
          >
            Скасувати
          </button>
        </div>
      )}

      {(configError || error) && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {configError || error}
        </div>
      )}
      <div ref={containerRef} className="min-h-12" />
    </div>
  );
}
