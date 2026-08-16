import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PendingPaymentsClient from "./PendingPaymentsClient";

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
          <h1 className="text-2xl font-bold text-gray-900">Оплати абонементів</h1>
          <p className="text-sm text-gray-500 mt-1">Керування запитами на поповнення балансу</p>
        </div>
        {!isHistory && (
          <div className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
            Очікують підтвердження: {purchases.length}
          </div>
        )}
      </div>

      <PendingPaymentsClient purchases={purchases} activeTab={tab} />
    </div>
  );
}
