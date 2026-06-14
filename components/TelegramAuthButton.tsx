"use client";

import { useState } from "react";
import TelegramDeepLinkAuth from "./TelegramDeepLinkAuth";

export default function TelegramAuthButton() {
  const [showAuth, setShowAuth] = useState(false);

  if (showAuth) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          <button
            onClick={() => setShowAuth(false)}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Закрити"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <TelegramDeepLinkAuth onSuccess={() => setShowAuth(false)} />
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowAuth(true)}
      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
    >
      Увійти
    </button>
  );
}
