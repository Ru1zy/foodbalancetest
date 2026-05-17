"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Step = "phone" | "otp";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState<string>("");

  // Check if user needs onboarding
  useEffect(() => {
    async function checkUser() {
      try {
        const response = await fetch("/api/user/profile");
        if (response.ok) {
          const data = await response.json();
          if (data.user && !data.user.phone.startsWith("google_")) {
            router.push("/profile");
          }
        }
      } catch (error) {
        console.error("Failed to check user:", error);
      }
    }
    checkUser();
  }, [router]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Помилка при обробці запиту");
        return;
      }

      if (data.requireOtp) {
        setStep("otp");
        setOtpMessage(data.message || "Код відправлено в Telegram");
      } else if (data.success) {
        router.push("/profile");
      }
    } catch (error) {
      console.error("Onboarding error:", error);
      setError("Помилка з'єднання. Спробуйте ще раз.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Невірний код підтвердження");
        return;
      }

      if (data.success) {
        router.refresh();
        router.push("/profile");
      }
    } catch (error) {
      console.error("Merge error:", error);
      setError("Помилка з'єднання. Спробуйте ще раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Завершення реєстрації</h1>
          <p className="mt-2 text-sm text-gray-600">
            {step === "phone"
              ? "Введіть ваш номер телефону для завершення налаштування аккаунта"
              : "Введіть код підтвердження з Telegram"}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className={`flex items-center ${step === "phone" ? "text-emerald-600" : "text-gray-400"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "phone" ? "bg-emerald-600 text-white" : "bg-gray-200"}`}>
              1
            </div>
            <span className="ml-2 text-sm font-medium">Телефон</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-200 mx-4"></div>
          <div className={`flex items-center ${step === "otp" ? "text-emerald-600" : "text-gray-400"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "otp" ? "bg-emerald-600 text-white" : "bg-gray-200"}`}>
              2
            </div>
            <span className="ml-2 text-sm font-medium">Код</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
            ⚠️ {error}
          </div>
        )}

        {/* OTP Message */}
        {otpMessage && step === "otp" && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            ✉️ {otpMessage}
          </div>
        )}

        {/* Step 1: Phone Input */}
        {step === "phone" && (
          <form onSubmit={handlePhoneSubmit} className="space-y-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Номер телефону
              </label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+380501234567"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                required
                disabled={loading}
              />
              <p className="mt-2 text-xs text-gray-500">
                Формат: +380501234567 або 0501234567
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !phone}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all active:scale-95"
            >
              {loading ? "Обробка..." : "Продовжити"}
            </button>
          </form>
        )}

        {/* Step 2: OTP Input */}
        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                Код підтвердження
              </label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="1234"
                maxLength={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl font-bold tracking-widest text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                required
                disabled={loading}
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500 text-center">
                Введіть 4-значний код з Telegram
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading || otp.length !== 4}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all active:scale-95"
              >
                {loading ? "Перевірка..." : "Підтвердити"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                  setError(null);
                  setOtpMessage("");
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl transition-all"
                disabled={loading}
              >
                Використати інший номер
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            🔒 Ваші дані захищені та використовуються тільки для оформлення замовлень
          </p>
        </div>
      </div>
    </div>
  );
}
