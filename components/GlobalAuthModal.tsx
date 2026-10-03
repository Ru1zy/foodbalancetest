"use client";

import { useEffect, useSyncExternalStore, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { useAuthModal } from "@/lib/authModalStore";
import TelegramDeepLinkAuth from "./TelegramDeepLinkAuth";

const subscribe = () => () => {};

function AuthModalWatcher() {
  const searchParams = useSearchParams();
  const openAuthModal = useAuthModal((s) => s.openAuthModal);

  useEffect(() => {
    const authType = searchParams.get("auth");
    if (!authType) return;

    const returnTo = searchParams.get("returnTo") || "/profile?tab=subscription#purchase-subscription";

    if (authType === "subscription") {
      openAuthModal({
        badge: "🎟️ Персональна знижка до -15%",
        title: "Вхід для оформлення абонемента",
        subtitle: "Щоб отримати знижку на абонемент та продовжити, будь ласка, увійдіть або зареєструйтесь",
        promoNotice: "Увійдіть через Telegram або Google, щоб закріпити вигідний тариф та активувати знижку.",
        returnTo,
      });
    } else if (authType === "required") {
      openAuthModal({
        title: "Вхід до особистого кабінету",
        subtitle: "Будь ласка, авторизуйтесь для доступу до цієї сторінки",
        returnTo,
      });
    }
  }, [searchParams, openAuthModal]);

  return null;
}

export default function GlobalAuthModal() {
  const { isOpen, closeAuthModal, title, subtitle, badge, promoNotice, returnTo } = useAuthModal();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    closeAuthModal();
    // Clean up ?auth= from URL if present without a page reload
    if (typeof window !== "undefined" && window.location.search.includes("auth=")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      url.searchParams.delete("returnTo");
      const cleanSearch = url.searchParams.toString();
      const newPath = url.pathname + (cleanSearch ? `?${cleanSearch}` : "") + url.hash;
      window.history.replaceState(null, "", newPath);
    }
  };

  const modal = isOpen ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl border border-gray-100 dark:border-slate-800"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Закрити"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <TelegramDeepLinkAuth
          onSuccess={handleClose}
          returnTo={returnTo}
          title={title}
          subtitle={subtitle}
          badge={badge}
          promoNotice={promoNotice}
        />
      </div>
    </div>
  ) : null;

  return (
    <>
      <Suspense fallback={null}>
        <AuthModalWatcher />
      </Suspense>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
