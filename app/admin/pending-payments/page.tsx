import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PendingPaymentsClient from "./PendingPaymentsClient";
import AdminHelpBanner from "@/components/admin/AdminHelpBanner";

export const dynamic = "force-dynamic";

export default async function PendingPaymentsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await getAuthenticatedAdminUser();
  
  if (!admin) {
    redirect("/admin/login");
  }

  const searchParams = await props.searchParams;
  const tab = searchParams?.tab || "pending";

  const isHistory = tab === "history";

  // Fetch purchases based on the tab
  const purchases = await prisma.subscriptionPurchase.findMany({
    where: isHistory 
      ? { status: { not: "CREDITED_PENDING_CONFIRMATION" } }
      : { status: "CREDITED_PENDING_CONFIRMATION" },
    include: {
      user: {
        select: {
          name: true,
          phone: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    // Limit history to last 100 for performance
    ...(isHistory ? { take: 100 } : {}),
  });

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Оплати абонементів</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Керування запитами на поповнення балансу</p>
        </div>
        {!isHistory && (
          <div className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
            Очікують підтвердження: {purchases.length}
          </div>
        )}
      </div>

      <AdminHelpBanner
        id="pending-payments"
        title="Модерація та підтвердження оплат за реквізитами"
        description="Перевірка надходження коштів на IBAN за придбані абонементи, звірка квитанцій та фіксація балансу."
        items={[
          {
            icon: "🧾",
            title: "Перевірка квитанції",
            text: "Клікніть на посилання або мініатюру чека, щоб переглянути прикріплену клієнтом банківську квитанцію.",
          },
          {
            icon: "✅",
            title: "Підтвердити оплату",
            text: "Підтверджує фактичне надходження коштів на розрахунковий рахунок і остаточно закріплює нараховані дні абонемента.",
          },
          {
            icon: "❌",
            title: "Відхилити платіж",
            text: "Якщо кошти не надійшли або чек недійсний — авансово нараховані дні автоматично списуються з балансу клієнта.",
          },
          {
            icon: "📜",
            title: "Вкладка 'Історія'",
            text: "Перемикайтеся на історію для перегляду останніх 100 оброблених платежів (успішних або відхилених).",
          },
          {
            icon: "⚡",
            title: "Миттєве зарахування",
            text: "Клієнт бачить оновлений баланс у своєму кабінеті одразу після вашого підтвердження в адмінці.",
          },
          {
            icon: "📞",
            title: "Швидкий контакт",
            text: "У картці відображається телефон та ім'я платника для швидкого уточнення деталей у разі невідповідності суми.",
          },
        ]}
        tips={[
          "Завжди звіряйте номер замовлення та суму у виписці онлайн-банкінгу перед натисканням 'Підтвердити'.",
        ]}
      />

      <PendingPaymentsClient purchases={purchases} activeTab={tab} />
    </div>
  );
}
