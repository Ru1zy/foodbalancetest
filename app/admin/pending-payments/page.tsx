import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PendingPaymentsClient from "./PendingPaymentsClient";
import AdminHelpBanner from "@/components/admin/AdminHelpBanner";

export const dynamic = "force-dynamic";

export default async function PendingPaymentsPage(props: {
  searchParams: Promise<{ tab?: string; type?: string }>;
}) {
  const admin = await getAuthenticatedAdminUser();

  if (!admin) {
    redirect("/admin/login");
  }

  const searchParams = await props.searchParams;
  const tab = searchParams?.tab === "history" ? "history" : "pending";
  const type = searchParams?.type === "orders" ? "orders" : "subscriptions";

  const isHistory = tab === "history";

  // Pending counts for badges
  const pendingPurchasesCount = await prisma.subscriptionPurchase.count({
    where: { status: "CREDITED_PENDING_CONFIRMATION" },
  });

  const pendingOrdersCount = await prisma.order.count({
    where: {
      AND: [
        {
          OR: [
            { paymentMethod: "bank_transfer" },
            { receiptUrl: { not: null } },
          ],
        },
        {
          isPaid: false,
          status: { not: "Скасовано" },
        },
      ],
    },
  });

  // Fetch subscription purchases
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
    ...(isHistory ? { take: 100 } : {}),
  });

  // Fetch daily ration orders with bank_transfer or receipt
  const orders = await prisma.order.findMany({
    where: isHistory
      ? {
          AND: [
            {
              OR: [
                { paymentMethod: "bank_transfer" },
                { receiptUrl: { not: null } },
              ],
            },
            {
              OR: [
                { isPaid: true },
                { status: "Скасовано" },
              ],
            },
          ],
        }
      : {
          AND: [
            {
              OR: [
                { paymentMethod: "bank_transfer" },
                { receiptUrl: { not: null } },
              ],
            },
            {
              isPaid: false,
              status: { not: "Скасовано" },
            },
          ],
        },
    include: {
      user: {
        select: {
          name: true,
          phone: true,
          address: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    ...(isHistory ? { take: 100 } : {}),
  });

  const totalPending = pendingPurchasesCount + pendingOrdersCount;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Оплати (IBAN / готівка)
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Керування оплатами за абонементи та окремі щоденні раціони
          </p>
        </div>
        {!isHistory && totalPending > 0 && (
          <div className="rounded-full bg-yellow-100 dark:bg-yellow-950/60 dark:text-yellow-300 px-3.5 py-1 text-sm font-semibold text-yellow-800 border border-yellow-200 dark:border-yellow-800">
            Очікують підтвердження: {totalPending}
          </div>
        )}
      </div>

      <AdminHelpBanner
        id="pending-payments"
        title="Модерація та підтвердження оплат за реквізитами (IBAN)"
        description="Перевірка надходження коштів на рахунок за абонементи або окремі щоденні раціони, звірка квитанцій та фіксація статусу оплати."
        items={[
          {
            icon: "🧾",
            title: "Перевірка квитанції",
            text: "Клікніть на мініатюру або посилання чека, щоб відкрити прикріплену клієнтом банківську квитанцію.",
          },
          {
            icon: "✅",
            title: "Підтвердити оплату",
            text: "Для абонемента — закріплює дні; для замовлення — встановлює статус 'Оплачено' та відправляє сповіщення клієнту.",
          },
          {
            icon: "❌",
            title: "Відхилити платіж",
            text: "Якщо кошти не надійшли або чек недійсний — авансово нараховані дні або замовлення скасовуються.",
          },
          {
            icon: "🗂️",
            title: "Розділи Абонементи / Раціони",
            text: "Швидко перемикайтеся між заявками на поповнення балансів та оплатами за щоденні раціони.",
          },
        ]}
        tips={[
          "Завжди звіряйте ім'я відправника, номер замовлення та суму у виписці онлайн-банкінгу перед натисканням 'Підтвердити'.",
        ]}
      />

      <PendingPaymentsClient
        purchases={purchases}
        orders={orders}
        activeType={type}
        activeTab={tab}
        pendingPurchasesCount={pendingPurchasesCount}
        pendingOrdersCount={pendingOrdersCount}
      />
    </div>
  );
}
