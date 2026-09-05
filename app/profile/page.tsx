import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAuthToken } from "@/lib/auth-token";
import prisma from "@/lib/prisma";
import type { Order, Prisma, UserBalance } from "@prisma/client";
import ProfilePageClient, { type OrderWithResolvedDishes, type ResolvedDay, type UnifiedAction } from "./ProfilePageClient";
import { parseCutleryCount } from "@/lib/checkout";
import { sanitizeTelegramPhone } from "@/lib/telegram-phone";
import { parseIndivDishId } from "@/lib/order-selection";
import { getAllTariffs } from "@/app/actions/tariff-impl";
import { getCachedMenus } from "@/lib/cache";
import { getPublicSettings } from "@/app/actions/settings";

const CATEGORY_LABELS: Record<string, string> = {
  breakfast: "Сніданок",
  lunch: "Обід",
  dinner: "Вечеря",
  snack: "Перекус",
  extra: "Додаткова страва",
};

type OrderDayItemPayload = {
  dishId?: string;
  quantity?: number;
};

type OrderDayPayload = {
  dayId?: string;
  items?: OrderDayItemPayload[];
  selections?: Record<string, unknown>;
};

type OrderItemsPayload = {
  days?: OrderDayPayload[];
};

async function resolveOrderDishes(order: {
  id: string;
  deliveryDate: Date;
  items: unknown;
  days?: { id: string; deliveryDate: Date; status: string }[];
}): Promise<ResolvedDay[]> {
  if (!order.items || typeof order.items !== "object") {
    return [];
  }

  const { days } = order.items as OrderItemsPayload;
  if (!Array.isArray(days) || days.length === 0) {
    return [];
  }

  // Collect all unique dayIds
  const dayIds = days
    .map((day) => day?.dayId)
    .filter((id): id is string => Boolean(id));

  if (dayIds.length === 0) {
    return [];
  }

  // Fetch all Menu records using cache to avoid N+1 queries
  const allMenus = await getCachedMenus();
  const menus = allMenus.filter(menu => dayIds.includes(menu.id));

  const menuById = new Map(
    menus.map((menu: { id: string; dishes: Prisma.JsonValue; dayOfWeek: number }) => [menu.id, menu]),
  );

  // `order.deliveryDate` is the calendar date of the EARLIEST selected day, i.e.
  // the day with the smallest `dayOfWeek` in the (single) menu week. Every day's
  // real date is therefore `deliveryDate + (dayOfWeek - minDayOfWeek)`. Using a
  // sequential `+ index` offset is wrong whenever days are non-consecutive
  // (e.g. Mon + Wed + Fri) — it would render Mon/Tue/Wed instead.
  const selectedDaysOfWeek = days
    .map((day) => (day?.dayId ? menuById.get(day.dayId)?.dayOfWeek : undefined))
    .filter((n): n is number => typeof n === "number");
  const minDayOfWeek = selectedDaysOfWeek.length > 0 ? Math.min(...selectedDaysOfWeek) : 1;

  // Resolve dish names per day
  const resolvedDays: ResolvedDay[] = [];

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    const dayDishes: string[] = [];

    // Calculate actual date for this day from its weekday (fallback to the
    // sequential index only when the menu row / dayOfWeek is unavailable).
    const dayOfWeek = day?.dayId ? menuById.get(day.dayId)?.dayOfWeek : undefined;
    const dateOffset = typeof dayOfWeek === "number" ? dayOfWeek - minDayOfWeek : dayIndex;
    const actualDate = new Date(order.deliveryDate);
    actualDate.setDate(actualDate.getDate() + dateOffset);

    // Handle individual package items (Indiv package)
    if (Array.isArray(day?.items) && day.dayId) {
      const menu = menuById.get(day.dayId);
      if (menu) {
        const dishes =
          typeof menu.dishes === "string"
            ? (JSON.parse(menu.dishes) as Record<string, unknown>)
            : (menu.dishes as Record<string, unknown>);

        for (const item of day.items) {
          const dishId = item.dishId || "";
          const quantity = typeof item.quantity === "number" ? item.quantity : 1;
          const parsed = parseIndivDishId(dishId);

          if (parsed) {
            const categoryLabel = CATEGORY_LABELS[parsed.category] || parsed.category;
            const categoryDishes = dishes[parsed.category];

            if (Array.isArray(categoryDishes) && categoryDishes[parsed.index]) {
              const dish = categoryDishes[parsed.index];
              const dishName =
                typeof dish === "object" && dish !== null
                  ? dish.full || dish.short || dish.name
                  : dish;

              dayDishes.push(`${categoryLabel}: ${String(dishName).trim()} x${quantity}`);
            } else {
              dayDishes.push(`${categoryLabel}: Страва не знайдена x${quantity}`);
            }
          } else {
            dayDishes.push(`${dishId} (x${quantity})`);
          }
        }
      }
    }

    // Handle standard package selections
    if (day?.selections && typeof day.selections === "object" && day.dayId) {
      const menu = menuById.get(day.dayId);

      if (menu) {
        const dishes =
          typeof menu.dishes === "string"
            ? (JSON.parse(menu.dishes) as Record<string, unknown>)
            : (menu.dishes as Record<string, unknown>);

        Object.entries(day.selections).forEach(([category, selectionIndex]) => {
          const categoryLabel = CATEGORY_LABELS[category] || category;
          const categoryDishes = dishes[category];

          if (
            Array.isArray(categoryDishes) &&
            typeof selectionIndex === "number" &&
            categoryDishes[selectionIndex]
          ) {
            const dish = categoryDishes[selectionIndex];
            const dishName =
              typeof dish === "object" && dish !== null
                ? dish.full || dish.short || dish.name
                : dish;

            if (dishName) {
              dayDishes.push(`${categoryLabel}: ${String(dishName).trim()}`);
            } else {
              dayDishes.push(`${categoryLabel}: Страва не знайдена`);
            }
          } else {
            dayDishes.push(`${categoryLabel}: Страва не знайдена`);
          }
        });
      }
    }

    // Match with actual OrderDay from DB
    const matchingOrderDay = order.days?.find(
      (d) =>
        d.deliveryDate.getUTCFullYear() === actualDate.getUTCFullYear() &&
        d.deliveryDate.getUTCMonth() === actualDate.getUTCMonth() &&
        d.deliveryDate.getUTCDate() === actualDate.getUTCDate()
    );

    resolvedDays.push({
      date: actualDate,
      dishes: dayDishes,
      orderDayId: matchingOrderDay?.id,
      status: matchingOrderDay?.status,
    });
  }

  return resolvedDays;
}

export default async function ProfilePage(
  props: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt(searchParams?.page as string || "1", 10));
  const limitParam = parseInt(searchParams?.limit as string || "10", 10);
  const ITEMS_PER_PAGE = [10, 25, 50, 100].includes(limitParam) ? limitParam : 10;

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

  // Prevent onboarding bypass: redirect if phone is placeholder
  if (dbUser.phone.startsWith("google_")) {
    redirect("/onboarding");
  }

  const user = {
    ...dbUser,
    defaultCutlery: parseCutleryCount(dbUser.defaultCutlery),
    phone: sanitizeTelegramPhone(dbUser.phone),
  };

  const rawBalances = await prisma.userBalance.findMany({
    where: { userId },
  });

  const activeBalances = rawBalances
    .filter((b: UserBalance) => b.totalDays - b.usedDays > 0)
    .map((b: UserBalance) => ({
      packageId: b.packageId,
      remainingDays: b.totalDays - b.usedDays,
    }));

  const [allOrders, allPurchases, tariffs, settings] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      select: { id: true, createdAt: true },
    }),
    prisma.subscriptionPurchase.findMany({
      where: { userId },
      select: { id: true, createdAt: true },
    }),
    getAllTariffs(),
    getPublicSettings()
  ]);

  const unifiedActions = [
    ...allOrders.map(o => ({ id: o.id, createdAt: o.createdAt, type: 'ORDER' as const })),
    ...allPurchases.map(p => ({ id: p.id, createdAt: p.createdAt, type: 'PURCHASE' as const }))
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const totalActions = unifiedActions.length;
  const totalPages = Math.max(1, Math.ceil(totalActions / ITEMS_PER_PAGE));
  const paginatedActions = unifiedActions.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const orderIds = paginatedActions.filter(a => a.type === 'ORDER').map(a => a.id);
  const purchaseIds = paginatedActions.filter(a => a.type === 'PURCHASE').map(a => a.id);

  const [rawOrders, rawPurchases] = await Promise.all([
    orderIds.length > 0 ? prisma.order.findMany({ 
      where: { id: { in: orderIds } }, 
      include: { days: { select: { id: true, deliveryDate: true, status: true } } } 
    }) : Promise.resolve([]),
    purchaseIds.length > 0 ? prisma.subscriptionPurchase.findMany({ where: { id: { in: purchaseIds } } }) : Promise.resolve([])
  ]);

  // Resolve dish names for all orders
  const ordersWithResolvedDishes: OrderWithResolvedDishes[] = await Promise.all(
    rawOrders.map(async (order: Order) => ({
      id: order.id,
      createdAt: order.createdAt,
      deliveryDate: order.deliveryDate,
      packageType: order.packageType,
      price: order.price,
      balanceDaysUsed: order.balanceDaysUsed,
      isPaid: order.isPaid,
      status: order.status,
      resolvedDays: await resolveOrderDishes(order),
    }))
  );

  const orderMap = new Map(ordersWithResolvedDishes.map(o => [o.id, o]));
  const purchaseMap = new Map(rawPurchases.map(p => [p.id, p]));

  const actions: UnifiedAction[] = paginatedActions.map(action => {
    if (action.type === 'ORDER') {
      return { type: 'ORDER' as const, data: orderMap.get(action.id)! };
    } else {
      return { type: 'PURCHASE' as const, data: purchaseMap.get(action.id)! };
    }
  }).filter(a => a.data !== undefined);

  return (
    <Suspense fallback={null}>
      <ProfilePageClient 
        user={user} 
        actions={actions} 
        balances={activeBalances} 
        tariffs={tariffs} 
        isNewClient={allOrders.length === 0}
        currentPage={page}
        totalPages={totalPages}
        totalActions={totalActions}
        itemsPerPage={ITEMS_PER_PAGE}
        ibanDetails={settings.ibanDetails}
      />
    </Suspense>
  );
}
