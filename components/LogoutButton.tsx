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
      className="bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700"
    >
      Вийти
    </button>
  );
}
