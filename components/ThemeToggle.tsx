"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-8 w-14 shrink-0" />; // Placeholder to avoid layout shift
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shadow-inner ${
        isDark ? "bg-slate-700 hover:bg-slate-600" : "bg-blue-100 hover:bg-blue-200"
      }`}
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
    >
      <span className="sr-only">Toggle dark mode</span>
      <span
        className={`pointer-events-none relative inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-300 ease-in-out ${
          isDark ? "translate-x-6" : "translate-x-0"
        }`}
      >
        {/* Sun Icon */}
        <span
          className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity duration-300 ease-in-out ${
            isDark ? "opacity-0 duration-100" : "opacity-100 duration-200"
          }`}
          aria-hidden="true"
        >
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        </span>
        {/* Moon Icon */}
        <span
          className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity duration-300 ease-in-out ${
            isDark ? "opacity-100 duration-200" : "opacity-0 duration-100"
          }`}
          aria-hidden="true"
        >
          <Moon className="h-3.5 w-3.5 text-slate-800" />
        </span>
      </span>
    </button>
  );
}
