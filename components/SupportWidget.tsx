"use client";

import { useState, useEffect } from "react";
import { MessageSquare, X, Send, Phone, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { FaTelegram } from "react-icons/fa";
import { createSupportTicketAction } from "@/app/actions/feedback";
import { SITE_CONFIG } from "@/lib/site-config";
import toast from "react-hot-toast";

const STORAGE_KEY = "fb_support_widget_hidden";

export default function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preference: whether the floating circle button is hidden
  const [isFloatingHidden, setIsFloatingHidden] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true") {
        setIsFloatingHidden(true);
      }
    } catch {}

    const handleOpen = () => setIsOpen(true);
    const handleToggleFloating = (e: CustomEvent<{ hidden?: boolean }>) => {
      if (e.detail?.hidden !== undefined) {
        setIsFloatingHidden(e.detail.hidden);
      } else {
        setIsFloatingHidden((prev) => !prev);
      }
    };

    window.addEventListener("open-support-widget", handleOpen);
    window.addEventListener("toggle-support-floating" as any, handleToggleFloating);
    return () => {
      window.removeEventListener("open-support-widget", handleOpen);
      window.removeEventListener("toggle-support-floating" as any, handleToggleFloating);
    };
  }, []);

  const handleDismissFloating = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsFloatingHidden(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
    toast("Кнопку підтримки приховано. Ви завжди можете написати нам через шапку або футер сайту.", {
      icon: "💬",
      duration: 4500,
    });
  };

  const handleRestoreFloating = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsFloatingHidden(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    toast.success("Плаваючу кнопку підтримки повернено на екран!", {
      duration: 3000,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("contact", contact);
    formData.append("message", message);

    try {
      const res = await createSupportTicketAction(formData);
      if (!res.ok) {
        setError(res.error || "Помилка при надсиланні звернення.");
      } else {
        setIsSuccess(true);
        setMessage("");
      }
    } catch {
      setError("Не вдалося надіслати. Перевірте з'єднання з інтернетом.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setIsSuccess(false);
      setError(null);
    }, 300);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {mounted && !isFloatingHidden && (
        <div className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-40 group/widget select-none animate-in fade-in zoom-in-95 duration-200">
          {/* Dismiss 'x' badge on hover or tap */}
          {!isOpen && (
            <button
              type="button"
              onClick={handleDismissFloating}
              title="Сховати плаваючий віджет з екрану"
              aria-label="Сховати кнопку підтримки"
              className="absolute -top-1.5 -left-1.5 z-50 flex h-5 w-5 sm:h-5.5 sm:w-5.5 items-center justify-center rounded-full bg-slate-900/90 dark:bg-slate-800 text-slate-300 hover:text-white hover:bg-rose-600 dark:hover:bg-rose-600 border border-slate-700/80 shadow-md transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer opacity-90 sm:opacity-0 sm:group-hover/widget:opacity-100"
            >
              <X className="h-3 w-3 stroke-[2.5]" />
            </button>
          )}

          {/* Main Round Floating Button */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="group relative flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-hidden focus:ring-4 focus:ring-emerald-500/30 cursor-pointer"
            aria-label="Підтримка та зворотний зв'язок"
            title="Підтримка та зворотний зв'язок"
          >
            {isOpen ? (
              <X className="h-5 w-5 sm:h-5.5 sm:w-5.5 transition-transform duration-200" />
            ) : (
              <>
                <MessageSquare className="h-5 w-5 sm:h-5.5 sm:w-5.5 transition-transform duration-200 group-hover:rotate-6" />
                {/* Subtle pulsing indicator */}
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Slide-in Modal / Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6 bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          <div
            className="w-full sm:w-[420px] max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-right-6 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shrink-0">
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base sm:text-lg leading-tight">Зв&apos;язатися з нами</h3>
                    <p className="text-xs text-emerald-100 mt-0.5">Відповідаємо щодня з 09:00 до 21:00</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="p-2 rounded-full hover:bg-white/20 transition cursor-pointer shrink-0"
                  aria-label="Закрити"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Notice when floating button is hidden */}
              {isFloatingHidden && (
                <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300">
                  <span>Плаваючу кнопку на екрані приховано.</span>
                  <button
                    type="button"
                    onClick={handleRestoreFloating}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer shrink-0"
                  >
                    Повернути на екран
                  </button>
                </div>
              )}

              {/* Quick links */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                  Швидкий зв&apos;язок
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <a
                    href={SITE_CONFIG.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-bold transition cursor-pointer"
                  >
                    <FaTelegram className="h-4 w-4" /> Telegram
                  </a>
                  <a
                    href={`tel:${SITE_CONFIG.phone.replace(/[^\d+]/g, "")}`}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition cursor-pointer"
                    title={`Зателефонувати: ${SITE_CONFIG.phoneDisplay}`}
                  >
                    <Phone className="h-4 w-4" /> Зателефонувати
                  </a>
                </div>
                <div className="mt-2 text-center">
                  <a
                    href={`tel:${SITE_CONFIG.phone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline transition-colors"
                  >
                    <Phone className="h-3 w-3" />
                    <span>{SITE_CONFIG.phoneDisplay}</span>
                  </a>
                </div>
              </div>

              <div className="relative flex items-center justify-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                <span className="absolute px-3 bg-white dark:bg-slate-900 text-[11px] uppercase tracking-wider text-slate-400">
                  або напишіть нам
                </span>
              </div>

              {/* Form Content or Success State */}
              {isSuccess ? (
                <div className="py-6 text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">Звернення надіслано!</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Адміністратор уже отримав сповіщення в Telegram і зв&apos;яжеться з вами найближчим часом.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSuccess(false);
                      handleClose();
                    }}
                    className="mt-2 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    Зрозуміло
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {error && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs leading-relaxed">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Ваше ім&apos;я
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Олександр"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Телефон або Telegram
                    </label>
                    <input
                      type="text"
                      required
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="+380... або @username"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Повідомлення / запитання
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Підкажіть, будь ласка, щодо раціону чи доставки..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition resize-none"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                        Надсилання...
                      </span>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" /> Надіслати повідомлення
                      </>
                    )}
                  </button>
                </form>
              )}

              {!isFloatingHidden && (
                <div className="pt-1 text-center border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleDismissFloating}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
                    title="Сховати круглу кнопку з кутка екрану"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>Сховати плаваючий значок з екрану</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
