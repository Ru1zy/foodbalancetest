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

  // Query clients with valid Telegram ChatID
  const clientsWithTelegram = await prisma.user.findMany({
    where: {
      chatId: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      chatId: true,
      address: true,
      _count: {
        select: {
          orders: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <main className="min-h-[100dvh] bg-gray-50 dark:bg-slate-950 p-6 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              📢 Сповіщення (Масова розсилка та Direct)
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">
              Надсилайте повідомлення всім підписникам бота разом або точково окремому клієнту
            </p>
          </div>
        </div>

        <AdminHelpBanner
          id="broadcast"
          title="Telegram-сповіщення (Розсилка та особисті повідомлення)"
          description="Інструмент для прямого зв'язку з клієнтами через Telegram-бота: масові анонси та індивідуальні сервісні повідомлення."
          items={[
            {
              icon: "👥",
              title: "Всім клієнтам",
              text: "Режим масової розсилки відправляє оголошення всім підписникам бота одночасно (меню, графіки, акції).",
            },
            {
              icon: "👤",
              title: "Окремому клієнту",
              text: "Перемикач 'Окремому клієнту' дозволяє знайти людину за ім'ям, телефоном чи ChatID та надіслати приватне повідомлення.",
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
              title: "Захист від помилок",
              text: "Перед масовою відправкою показується вікно підтвердження з числом отримувачів та фрагментом тексту.",
            },
          ]}
          tips={[
            "Для щоденного інформування про доставку з часом використовуйте вкладку '📅 Сьогодні'.",
            "Клієнт повинен хоча б один раз запустити бота, щоб система могла надіслати йому повідомлення.",
          ]}
        />

        <BroadcastClient clients={clientsWithTelegram} />
      </div>
    </main>
  );
}
