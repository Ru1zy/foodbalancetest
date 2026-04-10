"use client";

import { PropsWithChildren, useEffect, useRef } from "react";
import { useOrderStore } from "@/lib/orderStore";

type TmaAuthResponse = {
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

export default function TelegramProvider({ children }: PropsWithChildren) {
  const setCustomerProfile = useOrderStore((state) => state.setCustomerProfile);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) {
      return;
    }

    requestedRef.current = true;

    if (typeof window === "undefined") {
      return;
    }

    void import("@twa-dev/sdk")
      .then(async ({ default: WebApp }) => {
        try {
          WebApp.ready();
        } catch {
          return;
        }

        const initData = WebApp.initData;

        if (!initData) {
          return;
        }

        const response = await fetch("/api/auth/tma", {
          body: JSON.stringify({ initData }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          return;
        }

        const result = (await response.json()) as TmaAuthResponse;

        if (!result?.ok || !result.user) {
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
      })
      .catch((error) => {
        console.error("TelegramProvider auth request failed", error);
      });
  }, [setCustomerProfile]);

  return children;
}
