"use client";

import { useState } from "react";
import TelegramDeepLinkAuth from "./TelegramDeepLinkAuth";

export default function TelegramAuthButton() {
  const [showAuth, setShowAuth] = useState(false);

  if (showAuth) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-4 border border-gray-200 shadow-sm">
          <button
            onClick={() => setShowAuth(false)}
            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
          >
            ✕
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
