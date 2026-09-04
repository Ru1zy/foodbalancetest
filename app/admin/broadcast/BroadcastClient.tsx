"use client";

import { useState, useRef } from "react";
import { broadcastMessage } from "@/app/actions/admin";
import { 
  Send, 
  Bold, 
  Italic, 
  Code, 
  Link as LinkIcon, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  Sparkles 
} from "lucide-react";

interface Props {
  recipientCount: number;
}

const EMOJI_LIST = ["🚚", "🥗", "⏰", "🔥", "⭐", "🎁", "💬", "⚡", "🍏", "📦"];

export default function BroadcastClient({ recipientCount }: Props) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; sent: number; message?: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleSend = async () => {
    const trimmed = (content || "").trim();
    if (!trimmed) {
      alert("Введіть текст повідомлення перед відправкою.");
      return;
    }

    if (recipientCount === 0) {
      alert("Не знайдено жодного клієнта з підключеним Telegram.");
      return;
    }

    const confirmMsg = `УВАГА! Ви збираєтесь надіслати повідомлення ${recipientCount} користувачам у Telegram.\n\nПочаток тексту:\n"${trimmed.slice(0, 120)}..."\n\nПродовжити?`;
    if (!confirm(confirmMsg)) {
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const res = await broadcastMessage(trimmed);
      setResult({
        ok: res.ok,
        sent: res.sent,
        message: res.message,
      });

      if (res.ok) {
        setContent("");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Помилка при виконанні розсилки";
      setResult({
        ok: false,
        sent: 0,
        message,
      });
    } finally {
      setIsSending(false);
    }
  };

  // Convert supported telegram HTML into safe preview for UI
  const formatTelegramPreview = (html: string) => {
    if (!html.trim()) {
      return `<span class="text-slate-400 italic">Тут відображатиметься попередній перегляд вашого повідомлення...</span>`;
    }
    // Replace newlines with <br/>
    return html.replace(/\n/g, "<br/>");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Editor Column */}
      <div className="lg:col-span-7 space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm">
          {/* Header with recipient count badge */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>✍️ Скласти повідомлення</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Підтримується Telegram HTML розмітка та клікабельні посилання
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-3.5 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 self-start sm:self-auto">
              <Users className="w-4 h-4" />
              <span>Одержувачі: {recipientCount} клієнтів</span>
            </div>
          </div>

          {/* Formatting Toolbar */}
          <div className="pt-4 flex flex-wrap items-center justify-between gap-2">
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
            </div>

            {/* Quick emoji row */}
            <div className="flex items-center gap-1 overflow-x-auto py-1">
              {EMOJI_LIST.map((em) => (
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
          <div className="mt-3">
            <textarea
              ref={textareaRef}
              rows={9}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSending}
              placeholder="Введіть текст повідомлення для розсилки...&#10;&#10;Приклад:&#10;🚚 <b>Важливе оновлення!</b>&#10;Шановні клієнти, завтра доставка розпочнеться на 30 хвилин раніше.&#10;Свіже меню вже доступне на сайті!"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 font-sans"
            />
            <div className="flex justify-between items-center mt-2 text-xs text-slate-400">
              <span>Символів: {content.length}</span>
              <span>Підтримуються стандартні теги Telegram Bot API</span>
            </div>
          </div>

          {/* Action result banner */}
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
              <div>
                <p className="font-bold">
                  {result.ok
                    ? `Розсилку успішно виконано!`
                    : `Помилка розсилки:`}
                </p>
                <p className="mt-0.5 text-xs">
                  {result.ok
                    ? `Повідомлення надіслано ${result.sent} користувачам Telegram.`
                    : result.message}
                </p>
              </div>
            </div>
          )}

          {/* Send Button */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Повідомлення отримають усі зареєстровані користувачі бота</span>
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || !content.trim() || recipientCount === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-indigo-600"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? "Надсилаємо клієнтам..." : "Надіслати всім клієнтам"}</span>
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
                  <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.2 text-[9px] font-bold text-blue-600 dark:text-blue-300">bot</span>
                </div>
                <div className="text-[11px] text-blue-500 dark:text-blue-400">
                  бот FoodBalance
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
                  {new Date().toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          </div>

          {/* Tips Card */}
          <div className="mt-4 rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-xs text-amber-900 dark:text-amber-200">
            <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5" /> Порада перед запуском:
            </p>
            <p className="leading-relaxed">
              Telegram підтримує лише базові теги: <code>&lt;b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;code&gt;</code> та <code>&lt;a href=&quot;...&quot;&gt;</code>. Не використовуйте <code>&lt;div&gt;</code> або <code>&lt;p&gt;</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
