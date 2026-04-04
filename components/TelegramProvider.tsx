"use client";

import { PropsWithChildren, useEffect, useRef } from "react";
import { useOrderStore } from "@/src/store/orderStore";

type TmaAuthResponse = {
  ok: boolean;
  user?: {
    address?: string;
    chatId?: string;
    cutlery?: string;
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

        setCustomerProfile({
          address: result.user.address ?? "",
          chatId: result.user.chatId ?? "",
          cutlery: result.user.cutlery ?? "",
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
