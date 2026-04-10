"use client";

import { useEffect, useState } from "react";

export default function TelegramOAuthButton() {
  const [botId, setBotId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch bot ID from our API endpoint
    fetch("/api/telegram-bot-id")
      .then((res) => res.json())
      .then((data) => {
        if (data.botId) {
          setBotId(data.botId);
        }
      })
      .catch((err) => console.error("Failed to fetch bot ID:", err));
  }, []);

  const handleLogin = () => {
    if (!botId) {
      alert("Bot ID not loaded yet. Please try again.");
      return;
    }

    const origin = window.location.origin;
    const redirectUri = `${origin}/api/auth/telegram-oauth/callback`;
    const oauthUrl = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(origin)}&return_to=${encodeURIComponent(redirectUri)}`;

    window.location.href = oauthUrl;
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Увійти через Telegram</h2>
      <p className="text-xs text-gray-500 mb-4">
        Це потрібно лише для швидкого автозаповнення профілю. Замовлення можна оформити і без Telegram.
      </p>

      <button
        type="button"
        onClick={handleLogin}
        disabled={!botId}
        className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
          botId
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        {botId ? "Увійти через Telegram" : "Завантаження..."}
      </button>

      <p className="mt-3 text-xs text-gray-500">
        Ви будете перенаправлені на офіційний сайт Telegram для безпечної авторизації.
      </p>
    </div>
  );
}
