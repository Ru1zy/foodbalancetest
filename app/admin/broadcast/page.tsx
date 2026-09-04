import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import BroadcastClient from "./BroadcastClient";
import AdminHelpBanner from "@/components/admin/AdminHelpBanner";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage() {
  const adminUser = await getAuthenticatedAdminUser();

  if (!adminUser) {
    redirect("/admin/login");
  }

  // Count active recipients with Telegram ChatID
  const recipientCount = await prisma.user.count({
    where: {
      chatId: {
        not: null,
      },
    },
  });

  return (
    <main className="min-h-[100dvh] bg-gray-50 dark:bg-slate-950 p-6 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              📢 Масова розсилка (Сповіщення)
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">
              Пряме надсилання сповіщень та оголошень усім користувачам через Telegram-бота
            </p>
          </div>
        </div>

        <AdminHelpBanner
          id="broadcast"
          title="Масові Telegram-сповіщення (Розсилка)"
          description="Інструмент широкомовного інформування всіх підписників Telegram-бота: анонси нового меню, акції, технічні попередження або графік доставок."
          items={[
            {
              icon: "👥",
              title: "Охоплення аудиторії",
              text: "Повідомлення надсилається всім клієнтам, які хоча б один раз запустили Telegram-бота FoodBalance та мають дійсний ChatID.",
            },
            {
              icon: "🖋️",
              title: "HTML-форматування",
              text: "Використовуйте кнопки панелі для оформлення: жирний текст <b>, курсив <i>, код <code> та посилання <a href='...'>.",
            },
            {
              icon: "📱",
              title: "Живий передперегляд",
              text: "Праворуч розташований симулятор екрана Telegram: ви бачите повідомлення точно так, як його отримає клієнт.",
            },
            {
              icon: "⚡",
              title: "Безпека та ліміти",
              text: "Розсилка працює з інтервалом 50 мс між запитами, щоб не перевищувати ліміти Telegram Bot API (до 30 повідомлень/сек).",
            },
            {
              icon: "⚠️",
              title: "Підтвердження перед стартом",
              text: "Перед надсиланням з'являється системний діалог перевірки кількості одержувачів та фрагмента тексту.",
            },
            {
              icon: "📊",
              title: "Звіт про доставку",
              text: "Після завершення система виводить точну кількість успішно доставлених повідомлень.",
            },
          ]}
          tips={[
            "Перед надсиланням на велику аудиторію уважно перевірте посилання в режимі попереднього перегляду.",
            "Для персональних сповіщень щодо доставки на сьогодні використовуйте вкладку '📅 Сьогодні'.",
          ]}
        />

        <BroadcastClient recipientCount={recipientCount} />
      </div>
    </main>
  );
}
