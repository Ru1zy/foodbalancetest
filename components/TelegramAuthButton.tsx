"use client";

import { useState } from "react";
import TelegramDeepLinkAuth from "./TelegramDeepLinkAuth";

export default function TelegramAuthButton() {
  const [showAuth, setShowAuth] = useState(false);

  if (showAuth) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <button
            onClick={() => setShowAuth(false)}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
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
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
    >
      Увійти
    </button>
  );
}
