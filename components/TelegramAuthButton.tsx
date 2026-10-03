"use client";

import { useAuthModal } from "@/lib/authModalStore";

export default function TelegramAuthButton() {
  const openAuthModal = useAuthModal((s) => s.openAuthModal);

  return (
    <button
      onClick={() => openAuthModal()}
      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
    >
      Увійти
    </button>
  );
}
