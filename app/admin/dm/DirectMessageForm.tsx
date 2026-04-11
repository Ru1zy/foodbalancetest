"use client";

import { useState, useTransition } from "react";
import { sendDirectMessage } from "@/app/actions/admin";

type User = {
  id: string;
  name: string;
  phone: string;
  chatId: string | null;
};

type Props = {
  users: User[];
};

export default function DirectMessageForm({ users }: Props) {
  const [selectedChatId, setSelectedChatId] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedChatId || !message.trim()) {
      alert("Оберіть користувача та введіть повідомлення");
      return;
    }

    startTransition(async () => {
      const result = await sendDirectMessage(selectedChatId, message);
      if (result.ok) {
        setMessage("");
        alert("Повідомлення успішно відправлено!");
      } else {
        alert(`Помилка: ${result.message}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="user-select" className="block text-sm font-semibold text-gray-900 mb-2">
          Оберіть користувача
        </label>
        <select
          id="user-select"
          value={selectedChatId}
          onChange={(e) => setSelectedChatId(e.target.value)}
          disabled={isPending}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Оберіть користувача --</option>
          {users.map((user) => (
            <option key={user.id} value={user.chatId || ""}>
              {user.name} ({user.phone})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="message-textarea" className="block text-sm font-semibold text-gray-900 mb-2">
          Повідомлення (HTML підтримується)
        </label>
        <textarea
          id="message-textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isPending}
          rows={8}
          placeholder="Введіть текст повідомлення. Можна використовувати HTML теги: <b>жирний</b>, <i>курсив</i>, <code>код</code>"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={`w-full rounded-xl px-6 py-3 text-sm font-semibold transition ${
          isPending
            ? "cursor-not-allowed bg-gray-200 text-gray-400"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {isPending ? "Відправка..." : "Відправити повідомлення"}
      </button>
    </form>
  );
}
