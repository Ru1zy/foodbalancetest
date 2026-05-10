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
    try {
      const payload = await verifyAuthToken(token);
      if (payload) {
        const dbUser = await prisma.user.findUnique({
          where: { id: payload },
          select: {
            name: true,
            phone: true,
            address: true,
            defaultCutlery: true,
          },
        });
        if (dbUser) {
          // Prevent onboarding bypass: redirect if phone is placeholder
          if (dbUser.phone.startsWith("google_")) {
            redirect("/onboarding");
          }

          user = {
            name: dbUser.name,
            phone: sanitizeTelegramPhone(dbUser.phone),
            address: dbUser.address,
            defaultCutlery: parseCutleryCount(dbUser.defaultCutlery),
          };
        }
      }
    } catch {
      // Invalid token, ignore
    }
  }

  const menuRows = await prisma.menu.findMany({
    select: { id: true, dayOfWeek: true, packageType: true },
  });
  const menuDayByItemId: Record<string, number> = Object.fromEntries(
    menuRows.map((m) => [m.id, m.dayOfWeek]),
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
