"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { broadcastMessage, sendDirectTelegramMessage } from "@/app/actions/admin";
import { 
  Send, 
  Bold, 
  Italic, 
  Code, 
  Link as LinkIcon, 
  Users, 
  User, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  Sparkles, 
  X,
  MessageSquare,
  Smile
} from "lucide-react";

export type BroadcastUser = {
  id: string;
  name: string;
  phone: string;
  chatId: string | null;
  address: string | null;
  _count: {
    orders: number;
  };
};

interface Props {
  clients: BroadcastUser[];
}

const QUICK_EMOJIS = ["🚚", "🥗", "⏰", "🔥", "⭐", "🎁", "💬", "⚡"];

const EMOJI_CATEGORIES = [
  {
    id: "food",
    name: "Їжа",
    icon: "🥗",
    emojis: [
      "🥗", "🍲", "🍱", "🥩", "🍗", "🍳", "🥑", "🥦", "🥕", "🍅", 
      "🥒", "🍎", "🍌", "🍓", "🥣", "🥪", "🥘", "🥤", "☕", "🍽️",
      "🧀", "🍤", "🍣", "🌮", "🌯", "🍇", "🍊", "🍋", "🍯", "😋"
    ],
  },
  {
    id: "delivery",
    name: "Доставка",
    icon: "🚚",
    emojis: [
      "🚚", "🛵", "📦", "⏰", "⏱️", "⏳", "📍", "🗺️", "🔔", "🚪", 
      "🏠", "🏢", "🚗", "🚲", "🛣️", "🚦", "🎒", "📬", "📞", "📲"
    ],
  },
  {
    id: "emotions",
    name: "Емоції",
    icon: "👍",
    emojis: [
      "👍", "👋", "🙌", "🤝", "😊", "😎", "😉", "💪", "❤️", "🔥", 
      "⚡", "⭐", "✨", "💯", "🎯", "👏", "🎉", "👌", "🤩", "🥳",
      "🙏", "✌️", "😍", "🤤", "💃", "🕺", "🌟", "🏆", "🥇", "💥"
    ],
  },
  {
    id: "badges",
    name: "Значки",
    icon: "📢",
    emojis: [
      "📢", "💬", "ℹ️", "⚠️", "❗", "❓", "🎁", "🏷️", "💳", "💰", 
      "📅", "🚀", "✅", "❌", "📌", "🆕", "💎", "🔑", "🛡️", "🔗"
    ],
  },
];

export default function BroadcastClient({ clients }: Props) {
  const [mode, setMode] = useState<"all" | "single">("all");
  const [selectedClient, setSelectedClient] = useState<BroadcastUser | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  
  // Emoji picker states
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("food");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close emoji picker and search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setIsEmojiPickerOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter clients for autocomplete in single mode
  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);

    return clients.filter((c) => {
      const nameMatch = (c.name || "").toLowerCase().includes(q);
      const phoneMatch = (c.phone || "").toLowerCase().includes(q);
      const chatMatch = (c.chatId || "").toLowerCase().includes(q);
      return nameMatch || phoneMatch || chatMatch;
    }).slice(0, 10);
  }, [clients, clientSearch]);

  const insertTag = (openTag: string, closeTag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const replacement = `${openTag}${selectedText || "текст"}${closeTag}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + openTag.length,
        start + openTag.length + (selectedText.length || 5)
      );
    }, 0);
  };

  const insertLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const url = prompt("Введіть URL посилання (з https://):", "https://");
    if (!url) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || "посилання";
    const replacement = `<a href="${url}">${selectedText}</a>`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + emoji + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + emoji.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleSend = async () => {
    const trimmed = (content || "").trim();
    if (!trimmed) {
      alert("Введіть текст повідомлення перед відправкою.");
      return;
    }

    if (mode === "single") {
      if (!selectedClient || !selectedClient.chatId) {
        alert("Будь ласка, оберіть клієнта для надсилання повідомлення.");
        return;
      }

      const confirmSingle = `Надіслати персональне повідомлення клієнту ${selectedClient.name}?\n\nТекст:\n"${trimmed.slice(0, 100)}..."`;
      if (!confirm(confirmSingle)) {
        return;
      }

      setIsSending(true);
      setResult(null);

      try {
        const res = await sendDirectTelegramMessage(selectedClient.chatId, trimmed);
        setResult({
          ok: res.ok,
          message: res.ok
            ? `Повідомлення успішно надіслано клієнту ${selectedClient.name}!`
            : res.message || "Помилка при відправці",
        });

        if (res.ok) {
          setContent("");
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Помилка при виконанні";
        setResult({ ok: false, message });
      } finally {
        setIsSending(false);
      }
      return;
    }

    // Mode === "all"
    if (clients.length === 0) {
      alert("Не знайдено жодного клієнта з підключеним Telegram.");
      return;
    }

    const confirmMsg = `УВАГА! Ви збираєтесь надіслати повідомлення ВСІМ (${clients.length}) користувачам у Telegram.\n\nПочаток тексту:\n"${trimmed.slice(0, 120)}..."\n\nПродовжити?`;
    if (!confirm(confirmMsg)) {
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const res = await broadcastMessage(trimmed);
      setResult({
        ok: res.ok,
        message: res.ok
          ? `Розсилку успішно завершено! Відправлено ${res.sent} повідомлень.`
          : res.message || "Помилка при виконанні розсилки",
      });

      if (res.ok) {
        setContent("");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Помилка при виконанні розсилки";
      setResult({ ok: false, message });
    } finally {
      setIsSending(false);
    }
  };

  const formatTelegramPreview = (html: string) => {
    if (!html.trim()) {
      return `<span class="text-slate-400 italic">Тут відображатиметься попередній перегляд вашого повідомлення...</span>`;
    }
    return html.replace(/\n/g, "<br/>");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Editor Column */}
      <div className="lg:col-span-7 space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm">
          {/* Mode Selector Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("all");
                setResult(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition ${
                mode === "all"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Всім клієнтам ({clients.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("single");
                setResult(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition ${
                mode === "single"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <User className="w-4 h-4" />
              <span>Окремому клієнту</span>
            </button>
          </div>

          {/* Single Client Selection Interface */}
          {mode === "single" && (
            <div className="mb-5 p-4 rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/40 dark:bg-slate-800/60">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                👤 Одержувач повідомлення:
              </label>

              {selectedClient ? (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-sm">
                      {selectedClient.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 text-xs">
                      <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {selectedClient.name}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 truncate">
                        Тел: {selectedClient.phone} • ChatID: {selectedClient.chatId}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setIsSearchOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Змінити</span>
                  </button>
                </div>
              ) : (
                <div className="relative" ref={searchContainerRef}>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setIsSearchOpen(true);
                      }}
                      onFocus={() => setIsSearchOpen(true)}
                      placeholder="Введіть ім'я, телефон або ChatID для пошуку..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {isSearchOpen && (
                    <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-lg">
                      {filteredClients.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400">
                          Клієнтів з Telegram не знайдено
                        </div>
                      ) : (
                        filteredClients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedClient(c);
                              setIsSearchOpen(false);
                              setClientSearch("");
                            }}
                            className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-blue-50 dark:hover:bg-slate-800 transition"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white font-bold text-xs">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 text-xs">
                              <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {c.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {c.phone} • ID: {c.chatId}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Formatting Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => insertTag("<b>", "</b>")}
                disabled={isSending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Жирний (<b>текст</b>)"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertTag("<i>", "</i>")}
                disabled={isSending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Курсив (<i>текст</i>)"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertTag("<code>", "</code>")}
                disabled={isSending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Моноширинний код (<code>код</code>)"
              >
                <Code className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={insertLink}
                disabled={isSending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Вставити посилання (<a href=...>)"
              >
                <LinkIcon className="w-4 h-4" />
              </button>

              {/* Emoji Picker Dropdown Button */}
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                  disabled={isSending}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                    isEmojiPickerOpen
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                      : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  title="Відкрити меню смайликів"
                >
                  <Smile className="w-4 h-4 text-amber-500" />
                  <span>Смайли</span>
                </button>

                {/* Emoji Popover Menu */}
                {isEmojiPickerOpen && (
                  <div className="absolute left-0 top-full mt-2 z-30 w-72 sm:w-80 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Оберіть смайлик:
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEmojiPickerOpen(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Category Tabs */}
                    <div className="flex items-center gap-1 pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                      {EMOJI_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setActiveCategory(cat.id)}
                          className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-semibold transition ${
                            activeCategory === cat.id
                              ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <span>{cat.icon}</span>
                          <span className="hidden sm:inline">{cat.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Emoji Grid */}
                    <div className="grid grid-cols-7 sm:grid-cols-8 gap-1 max-h-48 overflow-y-auto p-1">
                      {EMOJI_CATEGORIES.find((cat) => cat.id === activeCategory)?.emojis.map(
                        (emoji, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg text-lg hover:bg-blue-50 dark:hover:bg-slate-800 transition active:scale-125"
                            title={emoji}
                          >
                            {emoji}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick emoji shortcuts row */}
            <div className="flex items-center gap-1 overflow-x-auto py-1">
              {QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => insertEmoji(em)}
                  disabled={isSending}
                  className="px-2 py-1 rounded-md text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="mt-2">
            <textarea
              ref={textareaRef}
              rows={9}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSending}
              placeholder={
                mode === "single"
                  ? "Введіть особисте повідомлення для клієнта...&#10;&#10;Приклад:&#10;Вітаємо, Владе! Ваше замовлення успішно оновлено. Зверніть увагу на нові страви у меню."
                  : "Введіть текст оголошення для всіх користувачів...&#10;&#10;Приклад:&#10;🚚 <b>Важливе оновлення!</b>&#10;Шановні клієнти, оновлено графік та меню на наступний тиждень."
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 font-sans"
            />
            <div className="flex justify-between items-center mt-2 text-xs text-slate-400">
              <span>Символів: {content.length}</span>
              <span>Підтримується розмітка Telegram HTML</span>
            </div>
          </div>

          {/* Result Alert */}
          {result && (
            <div
              className={`mt-4 rounded-xl p-4 border text-sm flex items-start gap-3 ${
                result.ok
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                  : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
              }`}
            >
              {result.ok ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="text-xs leading-relaxed">
                <p className="font-bold">{result.ok ? "Успішно виконано!" : "Помилка:"}</p>
                <p className="mt-0.5">{result.message}</p>
              </div>
            </div>
          )}

          {/* Send Button Card */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                {mode === "all"
                  ? `Повідомлення отримають усі ${clients.length} користувачів бота`
                  : selectedClient
                  ? `Адресат: ${selectedClient.name} (ChatID: ${selectedClient.chatId})`
                  : "Оберіть отримувача в списку вище"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={
                isSending ||
                !content.trim() ||
                (mode === "all" && clients.length === 0) ||
                (mode === "single" && !selectedClient)
              }
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>
                {isSending
                  ? "Відправка..."
                  : mode === "all"
                  ? `Надіслати всім (${clients.length})`
                  : `Надіслати клієнту`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Telegram Preview Column */}
      <div className="lg:col-span-5 space-y-4">
        <div className="sticky top-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            <Eye className="w-4 h-4 text-blue-500" />
            <span>Попередній перегляд у Telegram</span>
          </div>

          {/* Telegram Phone Simulator Frame */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#EFEFEF] dark:bg-[#0f141c] p-4 shadow-sm overflow-hidden">
            {/* Telegram Chat Header */}
            <div className="flex items-center gap-3 pb-3 mb-3 border-b border-slate-200/80 dark:border-slate-800/80">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white font-black text-sm">
                FB
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                  <span>FoodBalance Bot</span>
                  <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.2 text-[9px] font-bold text-blue-600 dark:text-blue-300">
                    bot
                  </span>
                </div>
                <div className="text-[11px] text-blue-500 dark:text-blue-400 truncate">
                  {mode === "all"
                    ? `📢 Канал розсилки (${clients.length} одержувачів)`
                    : selectedClient
                    ? `👤 Діалог з: ${selectedClient.name}`
                    : `👤 Персональне сповіщення`}
                </div>
              </div>
            </div>

            {/* Telegram Message Bubble */}
            <div className="flex justify-start">
              <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-white dark:bg-[#212d3b] p-3.5 shadow-sm text-xs leading-relaxed text-slate-900 dark:text-slate-100 break-words border border-slate-100 dark:border-slate-700/50">
                <div
                  dangerouslySetInnerHTML={{
                    __html: formatTelegramPreview(content),
                  }}
                  className="telegram-html-preview"
                />
                <div className="text-[10px] text-slate-400 text-right mt-1.5 select-none">
                  {new Date().toLocaleTimeString("uk-UA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Mode Info Card */}
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-4 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <span>Підказка:</span>
            </div>
            <p className="leading-relaxed">
              • Ви можете вставляти <b>будь-які смайлики</b> напряму з клавіатури (наприклад, <code>Win + .</code> у Windows), або обирати з випадаючого меню <code>😀 Смайли</code>.
            </p>
            <p className="leading-relaxed">
              • Усі стандартні емодзі підтримуються Telegram та коректно доставляються на пристрої клієнтів.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
