"use client";

import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    }
    // Hard redirect to home after logout
    window.location.href = "/";
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center justify-center rounded-xl bg-red-600 p-2 sm:px-4 sm:py-2 text-sm font-semibold text-white transition hover:bg-red-700"
      title="Вийти"
    >
      <LogOut className="h-5 w-5 sm:hidden" />
      <span className="hidden sm:inline">Вийти</span>
    </button>
  );
}
