"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { broadcastMessage, sendDirectTelegramMessage } from "@/app/actions/admin";
import { 
  Send, 
  Bold, 
  Italic, 
  Underline,
  Strikethrough,
  Code, 
  Quote,
  EyeOff,
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
  Smile,
  ChevronDown,
  HelpCircle,
  BookOpen,
  Check
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

export const TELEGRAM_HTML_CONSTRUCTS = [
  {
    id: "bold",
    title: "<b>Жирний заголовок</b>",
    description: "Для назв, головної інформації, суми",
    snippet: "<b>Ваш текст</b>",
    openTag: "<b>",
    closeTag: "</b>",
    placeholder: "Жирний текст",
    icon: "B",
    example: "<b>Важливе оновлення</b>",
  },
  {
    id: "italic",
    title: "<i>Курсив</i>",
    description: "Для приміток, підказок, ввічливих фраз",
    snippet: "<i>Ваш текст</i>",
    openTag: "<i>",
    closeTag: "</i>",
    placeholder: "Курсивний текст",
    icon: "I",
    example: "<i>(натисніть, щоб скопіювати)</i>",
  },
  {
    id: "underline",
    title: "<u>Підкреслений</u>",
    description: "Для акценту на термінах чи умовах",
    snippet: "<u>Ваш текст</u>",
    openTag: "<u>",
    closeTag: "</u>",
    placeholder: "Підкреслений текст",
    icon: "U",
    example: "<u>Тільки до неділі</u>",
  },
  {
    id: "strikethrough",
    title: "<s>Закреслена ціна</s>",
    description: "Для акцій (було <s>2400 ₴</s>, стало 2100 ₴)",
    snippet: "<s>2400 ₴</s>",
    openTag: "<s>",
    closeTag: "</s>",
    placeholder: "Стара ціна",
    icon: "S",
    example: "<s>2400 ₴</s> 2100 ₴",
  },
  {
    id: "code",
    title: "<code>Моно-код (копіювання в 1 тап)</code>",
    description: "Для промокодів, картки, телефону — клієнт копіює кліком",
    snippet: "<code>FOOD2026</code>",
    openTag: "<code>",
    closeTag: "</code>",
    placeholder: "ПРОМОКОД",
    icon: "C",
    example: "<code>0509916112</code>",
  },
  {
    id: "spoiler",
    title: "<tg-spoiler>Прихований спойлер</tg-spoiler>",
    description: "Текст приховано темним блоком, відкривається тапом",
    snippet: "<tg-spoiler>Секретний бонус</tg-spoiler>",
    openTag: "<tg-spoiler>",
    closeTag: "</tg-spoiler>",
    placeholder: "Секретний текст",
    icon: "🫣",
    example: "<tg-spoiler>Знижка 15%</tg-spoiler>",
  },
  {
    id: "quote",
    title: "<blockquote>Блок цитати</blockquote>",
    description: "Виділений блок з лівою смужкою для офіційних оголошень",
    snippet: "<blockquote>Важливе повідомлення або правило сервісу</blockquote>",
    openTag: "<blockquote>",
    closeTag: "</blockquote>",
    placeholder: "Текст цитати",
    icon: "❝",
    example: "<blockquote>Доставка працює з 06:00 до 09:00</blockquote>",
  },
  {
    id: "link",
    title: '<a href="...">Посилання на сайт</a>',
    description: "Клікабельний текст з переходом на сайт",
    snippet: '<a href="https://foodbalance.com.ua">Перейти на сайт</a>',
    openTag: '<a href="https://foodbalance.com.ua">',
    closeTag: "</a>",
    placeholder: "Текст посилання",
    icon: "🔗",
    example: '<a href="https://foodbalance.com.ua">foodbalance.com.ua</a>',
  },
];

export const TELEGRAM_TEMPLATES = [
  {
    id: "delivery",
    title: "🚚 Сповіщення про доставку",
    description: "Повідомлення клієнту, що замовлення у кур'єра",
    snippet: `🚚 <b>Доставка вашого замовлення!</b>\n\nШановний клієнте, ваш раціон успішно зібрано та передано кур'єру.\nОчікуйте доставку у звичний ранковий інтервал.\n\n📞 Зв'язок з нами: <code>0509916112</code>`,
  },
  {
    id: "promo",
    title: "🔥 Акція та промокод",
    description: "Знижка на наступний тиждень або замовлення",
    snippet: `🔥 <b>Спеціальна пропозиція від FoodBalance!</b>\n\nОтримайте знижку на наступне замовлення за промокодом:\n<code>FOOD10</code> <i>(натисніть на код, щоб скопіювати)</i>\n\n👉 Оформити замовлення: <a href="https://foodbalance.com.ua">foodbalance.com.ua</a>`,
  },
  {
    id: "menu_update",
    title: "🥗 Оновлення меню",
    description: "Оголошення про нові страви та раціони",
    snippet: `🥗 <b>Оновлено щотижневе меню!</b>\n\nМи додали нові свіжі страви у всі тарифи на наступний тиждень.\nОзнайомтесь з оновленим меню на нашому сайті:\n\n👉 <a href="https://foodbalance.com.ua">Переглянути меню</a>`,
  },
  {
    id: "payment_reminder",
    title: "💳 Нагадування про оплату",
    description: "Ввічливе нагадування про сплату замовлення",
    snippet: `💳 <b>Нагадування про оплату</b>\n\nБудь ласка, не забудьте сплатити замовлення для підтвердження доставки на завтра.\n\nЯкщо ви вже оплатили — щиро дякуємо, очікуйте на кур'єра!`,
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
  
  // Emoji picker & constructs dropdown & guide modal states
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isConstructsOpen, setIsConstructsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("food");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const constructsRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close emoji picker and search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setIsEmojiPickerOpen(false);
      }
      if (constructsRef.current && !constructsRef.current.contains(target)) {
        setIsConstructsOpen(false);
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

  // Handle Escape key to close modal/popovers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsGuideOpen(false);
        setIsConstructsOpen(false);
        setIsEmojiPickerOpen(false);
        setIsSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  const insertTag = (openTag: string, closeTag: string, placeholder = "текст") => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => (prev ? `${prev} ${openTag}${placeholder}${closeTag}` : `${openTag}${placeholder}${closeTag}`));
      return;
    }

    const start = textarea.selectionStart ?? content.length;
    const end = textarea.selectionEnd ?? content.length;
    const selectedText = content.substring(start, end);
    const textToWrap = selectedText || placeholder;
    const replacement = `${openTag}${textToWrap}${closeTag}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + openTag.length,
        start + openTag.length + textToWrap.length
      );
    }, 0);
  };

  const insertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));
      return;
    }

    const start = textarea.selectionStart ?? content.length;
    const end = textarea.selectionEnd ?? content.length;

    // If text was selected, replace selection
    if (start !== end) {
      const newContent = content.substring(0, start) + snippet + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        textarea.focus();
        const newPos = start + snippet.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
      return;
    }

    // No selection: insert at cursor position (or append), never replacing existing text
    const before = content.substring(0, start);
    const after = content.substring(start);
    const needsNewline = before.length > 0 && !before.endsWith("\n") && !snippet.startsWith("\n");
    const inserted = (needsNewline ? "\n\n" : "") + snippet;

    const newContent = before + inserted + after;
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + inserted.length;
      textarea.setSelectionRange(newPos, newPos);
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
          ? `Розсилку успішно завершено! Надіслано ${res.sent} повідомлень.`
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
    const formatted = html
      .replace(/<tg-spoiler>/gi, '<span class="telegram-spoiler" title="Натисніть або наведіть, щоб прочитати">')
      .replace(/<\/tg-spoiler>/gi, "</span>");

    return formatted.replace(/\n/g, "<br/>");
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
            <div className="flex flex-wrap items-center gap-1">
              {/* Bold */}
              <button
                type="button"
                onClick={() => insertTag("<b>", "</b>", "жирний текст")}
                disabled={isSending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Жирний (<b>текст</b>)"
              >
                <Bold className="w-4 h-4" />
              </button>

              {/* Italic */}
              <button
                type="button"
                onClick={() => insertTag("<i>", "</i>", "курсивний текст")}
                disabled={isSending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Курсив (<i>текст</i>)"
              >
                <Italic className="w-4 h-4" />
              </button>

              {/* Underline */}
              <button
                type="button"
                onClick={() => insertTag("<u>", "</u>", "підкреслений текст")}
                disabled={isSending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Підкреслений (<u>текст</u>)"
              >
                <Underline className="w-4 h-4" />
              </button>

              {/* Strikethrough */}
              <button
                type="button"
                onClick={() => insertTag("<s>", "</s>", "закреслений текст")}
                disabled={isSending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Закреслений (<s>текст</s>) для цін або акцій"
              >
                <Strikethrough className="w-4 h-4" />
              </button>

              {/* Monospace Code */}
              <button
                type="button"
                onClick={() => insertTag("<code>", "</code>", "КОД_АБО_ТЕЛЕФОН")}
                disabled={isSending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Моноширинний код (<code>текст</code> — копіюється кліком у Telegram)"
              >
                <Code className="w-4 h-4" />
              </button>

              {/* Spoiler */}
              <button
                type="button"
                onClick={() => insertTag("<tg-spoiler>", "</tg-spoiler>", "прихований спойлер")}
                disabled={isSending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Спойлер (<tg-spoiler>текст</tg-spoiler> — приховано плашкою)"
              >
                <EyeOff className="w-4 h-4" />
              </button>

              {/* Quote */}
              <button
                type="button"
                onClick={() => insertTag("<blockquote>", "</blockquote>", "текст цитати")}
                disabled={isSending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Блок цитати (<blockquote>текст</blockquote>)"
              >
                <Quote className="w-4 h-4" />
              </button>

              {/* Link */}
              <button
                type="button"
                onClick={insertLink}
                disabled={isSending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Вставити посилання (<a href=...>)"
              >
                <LinkIcon className="w-4 h-4" />
              </button>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

              {/* Constructs & Templates Dropdown */}
              <div className="relative" ref={constructsRef}>
                <button
                  type="button"
                  onClick={() => setIsConstructsOpen((prev) => !prev)}
                  disabled={isSending}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition shadow-sm ${
                    isConstructsOpen
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-200 dark:ring-indigo-900/50"
                      : "border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                  }`}
                  title="Швидкі конструкції Telegram та готові шаблони FoodBalance"
                >
                  <span className="text-sm">🧩</span>
                  <span>Конструкції</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isConstructsOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Constructs Popover */}
                {isConstructsOpen && (
                  <div className="absolute left-0 top-full mt-2 z-30 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span>🧩 Telegram конструкції</span>
                        </div>
                        <div className="text-[10.5px] text-slate-400">
                          Вставляється в поточне місце без стирання тексту
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsConstructsOpen(false)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto space-y-3.5 pr-1 text-xs">
                      {/* Formats Grid */}
                      <div>
                        <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 flex items-center justify-between">
                          <span>Теги оформлення:</span>
                          <span className="text-[10px] font-normal text-slate-400">тисни для вставки</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {TELEGRAM_HTML_CONSTRUCTS.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                insertTag(item.openTag, item.closeTag, item.placeholder);
                                setIsConstructsOpen(false);
                              }}
                              className="flex flex-col items-start p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-300 dark:hover:border-indigo-700 text-left transition group"
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                  {item.title.replace(/<[^>]*>/g, "")}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-bold">
                                  {item.openTag}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                                {item.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Templates List */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                          Готові шаблони для клієнтів (додати в кінець):
                        </div>
                        <div className="space-y-1.5">
                          {TELEGRAM_TEMPLATES.map((tpl) => (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => {
                                insertSnippet(tpl.snippet);
                                setIsConstructsOpen(false);
                              }}
                              className="flex items-center justify-between w-full p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:border-blue-300 dark:hover:border-blue-700 text-left transition group"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                                  {tpl.title}
                                </div>
                                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                                  {tpl.description}
                                </div>
                              </div>
                              <span className="shrink-0 text-[10px] font-bold text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md bg-blue-100/80 dark:bg-blue-900/60 group-hover:bg-blue-600 group-hover:text-white transition">
                                + Вставити
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Emoji Picker Dropdown Button */}
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                  disabled={isSending}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                    isEmojiPickerOpen
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
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

              {/* Guide Button in toolbar */}
              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                disabled={isSending}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-xs font-semibold transition"
                title="Відкрити гайд та шпаргалку з Telegram HTML"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Шпаргалка HTML</span>
              </button>
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
                  ? "Введіть особисте повідомлення для клієнта...\n\nПриклад:\nВітаємо, Владе! Ваше замовлення успішно оновлено. Зверніть увагу на нові страви у меню."
                  : "Введіть текст оголошення для всіх користувачів...\n\nПриклад:\n🚚 <b>Важливе оновлення!</b>\nШановні клієнти, оновлено графік та меню на наступний тиждень."
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 font-sans"
            />
            <div className="flex justify-between items-center mt-2 text-xs text-slate-400">
              <span>Символів: {content.length}</span>
              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline transition font-medium cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Підтримується Telegram HTML (Гайд)</span>
              </button>
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

      {/* Telegram HTML Guide Modal */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/50 dark:from-slate-900 dark:to-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Гайд з форматування Telegram HTML
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Шпаргалка для адміністратора: як оформлювати розсилки без помилок
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
              {/* 3 Golden Rules */}
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 p-4 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>3 Головні правила (щоб бот не видавав помилку)</span>
                </div>
                <ul className="text-xs text-amber-900 dark:text-amber-200 space-y-1.5 list-disc list-inside">
                  <li>
                    <b>Кожен тег обов&apos;язково закривати:</b> якщо відкрили <code>&lt;b&gt;</code>, в кінці фрази має бути <code>&lt;/b&gt;</code>. Якщо забути — повідомлення не відправиться!
                  </li>
                  <li>
                    <b>Не можна використовувати символи &lt; або &gt; у звичайному тексті:</b> Telegram сприйме це як неіснуючий HTML-тег і видасть помилку. Замість <code>&lt; 500 грн</code> пишіть словами: <code>менше 500 грн</code>.
                  </li>
                  <li>
                    <b>Не перехрещувати теги:</b> правильно: <code>&lt;b&gt;&lt;i&gt;текст&lt;/i&gt;&lt;/b&gt;</code>, а неправильно: <code>&lt;b&gt;&lt;i&gt;текст&lt;/b&gt;&lt;/i&gt;</code>.
                  </li>
                </ul>
              </div>

              {/* Tags Cheatsheet Table */}
              <div className="space-y-3">
                <div className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Всі доступні конструкції з живими прикладами
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                      <tr>
                        <th className="p-3">Стиль</th>
                        <th className="p-3">Як писати в редакторі</th>
                        <th className="p-3">Як бачить клієнт у Telegram</th>
                        <th className="p-3 text-right">Дія</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {TELEGRAM_HTML_CONSTRUCTS.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                            <div>{item.title.replace(/<[^>]*>/g, "")}</div>
                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">{item.description}</div>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-slate-50/40 dark:bg-slate-900/40">
                            <code>{item.snippet}</code>
                          </td>
                          <td className="p-3">
                            <div
                              dangerouslySetInnerHTML={{ __html: formatTelegramPreview(item.snippet) }}
                              className="telegram-html-preview text-slate-900 dark:text-slate-100"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                insertSnippet(item.snippet);
                                setIsGuideOpen(false);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>+ Вставити</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Ready-made templates */}
              <div className="space-y-3">
                <div className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Готові комбо-шаблони для клієнтів (в 1 клік)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TELEGRAM_TEMPLATES.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between"
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          {tpl.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {tpl.description}
                        </div>
                        <div className="mt-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 max-h-24 overflow-y-auto whitespace-pre-wrap">
                          {tpl.snippet}
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            insertSnippet(tpl.snippet);
                            setIsGuideOpen(false);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                          Вставити цей шаблон
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                💡 Всі ці теги також доступні в меню <b>🧩 Конструкції</b> над полем вводу
              </div>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Зрозуміло, закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
