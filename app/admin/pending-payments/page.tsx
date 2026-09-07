import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PendingPaymentsClient, { type RefundItem } from "./PendingPaymentsClient";
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
  const type =
    searchParams?.type === "refunds"
      ? "refunds"
      : searchParams?.type === "orders"
      ? "orders"
      : "subscriptions";

  const isHistory = tab === "history";

  // 1. Pending counts for subscription purchases (IBAN)
  const pendingPurchasesCount = await prisma.subscriptionPurchase.count({
    where: { status: "CREDITED_PENDING_CONFIRMATION" },
  });

  // 2. Pending counts for daily ration orders (IBAN / receipt unconfirmed)
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

  // 3. Fetch potential refund orders:
  // Orders where money was paid (isPaid: true, price > 0)
  // and either order.status is "cancelled" or some days are "cancelled"
  const potentialRefundOrders = await prisma.order.findMany({
    where: {
      isPaid: true,
      price: { gt: 0 },
      OR: [
        { status: "cancelled" },
        { days: { some: { status: "cancelled" } } },
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
      days: {
        orderBy: { deliveryDate: "asc" },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Map into structured RefundItem
  const refundItems: RefundItem[] = potentialRefundOrders
    .map((order) => {
      const cancelledDays = order.days.filter((d) => d.status === "cancelled");
      const totalDaysCount = order.days.length || 1;
      
      // How many cancelled days are fiat (not covered by subscription balance)
      const fiatCancelledCount =
        order.days.length > 0
          ? Math.max(0, cancelledDays.length - order.balanceDaysUsed)
          : order.status === "cancelled"
          ? 1
          : 0;

      const isResolved =
        cancelledDays.length > 0
          ? cancelledDays.every((d) => d.cancelReason?.includes("[RESOLVED"))
          : Boolean(order.notes?.includes("[RESOLVED"));

      // Estimate refund amount: proportion of price for fiat cancelled days
      const refundAmount =
        order.days.length > 0 && order.price
          ? cancelledDays.length === order.days.length
            ? order.price
            : Math.round((order.price / totalDaysCount) * fiatCancelledCount)
          : order.price || 0;

      const latestCancelledAt = cancelledDays.reduce<Date | null>((latest, d) => {
        if (!d.cancelledAt) return latest;
        return !latest || d.cancelledAt > latest ? d.cancelledAt : latest;
      }, null);

      return {
        id: order.id,
        packageType: order.packageType,
        totalPrice: order.price || 0,
        refundAmount,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        cancelledAt: latestCancelledAt,
        cancelledDaysCount: cancelledDays.length,
        totalDaysCount,
        fiatCancelledCount,
        cancelledDates: cancelledDays.map((d) => d.deliveryDate),
        cancelReason: cancelledDays[0]?.cancelReason || order.notes || null,
        isResolved,
        user: order.user,
      };
    })
    .filter((item) => item.fiatCancelledCount > 0);

  const pendingRefunds = refundItems.filter((item) => !item.isResolved);
  const historyRefunds = refundItems.filter((item) => item.isResolved);
  const pendingRefundsCount = pendingRefunds.length;
  const displayedRefunds = isHistory ? historyRefunds : pendingRefunds;

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

  const totalPending = pendingPurchasesCount + pendingOrdersCount + pendingRefundsCount;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Оплати та повернення
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Підтвердження банківських оплат (IBAN) та врегулювання скасованих раціонів (Refunds)
          </p>
        </div>
        {!isHistory && totalPending > 0 && (
          <div className="rounded-full bg-yellow-100 dark:bg-yellow-950/60 dark:text-yellow-300 px-3.5 py-1 text-sm font-semibold text-yellow-800 border border-yellow-200 dark:border-yellow-800">
            Потребують уваги: {totalPending}
          </div>
        )}
      </div>

      <AdminHelpBanner
        id="pending-payments"
        title="Модерація оплат та повернення коштів (Refunds)"
        description="Перевірка надходження коштів на рахунок IBAN, звірка квитанцій, а також контроль скасованих раціонів, за які було сплачено кошти."
        items={[
          {
            icon: "🧾",
            title: "Перевірка квитанції",
            text: "Клікніть на мініатюру або посилання чека (фото чи PDF), щоб переглянути банківську виписку клієнта.",
          },
          {
            icon: "✅",
            title: "Підтвердити оплату",
            text: "Для абонемента — закріплює дні; для замовлення — встановлює статус 'Оплачено' та надсилає сповіщення клієнту.",
          },
          {
            icon: "💸",
            title: "До повернення (Refunds)",
            text: "Всі замовлення, які клієнти скасували після оплати (карткою Plata by mono або IBAN). Ви можете в 1 клік нарахувати день на баланс в CRM або позначити кошти як повернені.",
          },
          {
            icon: "❌",
            title: "Відхилити платіж",
            text: "Якщо кошти не надійшли або чек підроблений — авансово нараховані дні або замовлення анулюються.",
          },
        ]}
        tips={[
          "Завжди звіряйте ім'я відправника та суму у виписці інтернет-банкінгу перед підтвердженням.",
          "Якщо клієнт скасував замовлення, зателефонуйте йому: більшість залюбки погоджуються на перенесення дня на баланс замість повернення коштів на карту.",
        ]}
      />

      <PendingPaymentsClient
        purchases={purchases}
        orders={orders}
        refunds={displayedRefunds}
        activeType={type}
        activeTab={tab}
        pendingPurchasesCount={pendingPurchasesCount}
        pendingOrdersCount={pendingOrdersCount}
        pendingRefundsCount={pendingRefundsCount}
      />
    </div>
  );
}
