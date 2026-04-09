"use client";

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
      className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
    >
      Вийти
    </button>
  );
}
