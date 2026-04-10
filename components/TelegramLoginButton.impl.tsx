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
  const configError = !BOT_USERNAME
    ? "NEXT_PUBLIC_BOT_USERNAME не заданий. Telegram Login Widget не може бути показаний."
    : null;
  const router = useRouter();

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
      {(configError || error) && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {configError || error}
        </div>
      )}
      <div ref={containerRef} className="min-h-12" />
    </div>
  );
}
