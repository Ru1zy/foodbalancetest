import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAuthToken } from "@/lib/auth-token";
import prisma from "@/lib/prisma";
import CheckoutPageImpl from "./page-impl";
import { parseCutleryCount } from "@/lib/checkout";
import { sanitizeTelegramPhone } from "@/lib/telegram-phone";

export default async function CheckoutPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  let user = null;
  if (token) {
    let userId: string | null = null;
    try {
      userId = await verifyAuthToken(token);
    } catch {
      // Invalid token, ignore
    }

    if (userId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          phone: true,
          address: true,
          defaultCutlery: true,
        },
      });

      // redirect() deliberately throws NEXT_REDIRECT, so it must stay outside
      // the token-verification try/catch above.
      if (dbUser?.phone.startsWith("google_")) {
        redirect("/onboarding");
      }

      if (dbUser) {
        user = {
          name: dbUser.name,
          phone: sanitizeTelegramPhone(dbUser.phone),
          address: dbUser.address,
          defaultCutlery: parseCutleryCount(dbUser.defaultCutlery),
        };
      }
    }
  }

  const menuRows = await prisma.menu.findMany({
    select: { id: true, dayOfWeek: true, packageType: true },
  });
  const menuDayByItemId: Record<string, number> = Object.fromEntries(
    menuRows.map((m: { id: string; dayOfWeek: number }) => [m.id, m.dayOfWeek]),
  );

  const sushkaMenuIdByDay: Record<number, string> = {};
  for (const m of menuRows) {
    if (m.packageType === "Sushka") {
      sushkaMenuIdByDay[m.dayOfWeek] = m.id;
    }
  }

  return (
    <CheckoutPageImpl
      authenticatedUser={user}
      menuDayByItemId={menuDayByItemId}
      sushkaMenuIdByDay={sushkaMenuIdByDay}
    />
  );
}
