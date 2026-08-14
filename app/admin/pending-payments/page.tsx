import { getAuthenticatedAdminUser } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import PendingPaymentsClient from "./PendingPaymentsClient";

export const dynamic = "force-dynamic";

export default async function PendingPaymentsPage() {
  const admin = await getAuthenticatedAdminUser();
  
  if (!admin) {
    redirect("/admin/login");
  }

  const pendingPurchases = await prisma.subscriptionPurchase.findMany({
    where: {
      status: "CREDITED_PENDING_CONFIRMATION",
    },
    include: {
      user: {
        select: {
          name: true,
          phone: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Неоплачені заявки</h1>
        <div className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
          Очікують підтвердження: {pendingPurchases.length}
        </div>
      </div>

      <PendingPaymentsClient purchases={pendingPurchases} />
    </div>
  );
}
