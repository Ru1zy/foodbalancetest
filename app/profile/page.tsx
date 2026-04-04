import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAuthToken } from "@/src/lib/auth-token";
import prisma from "@/lib/prisma";
import ProfilePageClient, { type OrderItems } from "./ProfilePageClient";
import { parseCutleryCount } from "@/src/lib/checkout";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/");
  }

  let userId: string;
  try {
    const payload = await verifyAuthToken(token);
    if (!payload) {
      redirect("/");
    }
    userId = payload;
  } catch {
    redirect("/");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!dbUser) {
    redirect("/");
  }

  const user = {
    ...dbUser,
    defaultCutlery: parseCutleryCount(dbUser.defaultCutlery),
  };

  const rawOrders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const formattedOrders = rawOrders.map(order => ({
    ...order,
    items: order.items as unknown as OrderItems
  }));

  return <ProfilePageClient user={user} orders={formattedOrders} />;
}