import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAuthToken } from "@/lib/auth-token";
import prisma from "@/lib/prisma";
import type { Order, Prisma, UserBalance } from "@prisma/client";
import ProfilePageClient, { type OrderWithResolvedDishes, type ResolvedDay } from "./ProfilePageClient";
import { parseCutleryCount } from "@/lib/checkout";
import { sanitizeTelegramPhone } from "@/lib/telegram-phone";
import { parseIndivDishId } from "@/lib/order-selection";
import { getAllTariffs } from "@/app/actions/tariff-impl";

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
  deliveryDate: Date;
  items: unknown;
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

  // Fetch all Menu records in one query
  const menus = await prisma.menu.findMany({
    where: {
      id: {
        in: dayIds,
      },
    },
    select: {
      id: true,
      dishes: true,
    },
  });

  const menuById = new Map(menus.map((menu: { id: string; dishes: Prisma.JsonValue }) => [menu.id, menu]));

  // Resolve dish names per day
  const resolvedDays: ResolvedDay[] = [];

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    const dayDishes: string[] = [];

    // Calculate actual date for this day
    const actualDate = new Date(order.deliveryDate);
    actualDate.setDate(actualDate.getDate() + dayIndex);

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

    resolvedDays.push({
      date: actualDate,
      dishes: dayDishes,
    });
  }

  return resolvedDays;
}

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

  const rawOrders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const orderCount = await prisma.order.count({
    where: { userId },
  });

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

  const tariffs = await getAllTariffs();

  return (
    <ProfilePageClient 
      user={user} 
      orders={ordersWithResolvedDishes} 
      balances={activeBalances} 
      tariffs={tariffs} 
      isNewClient={orderCount === 0}
    />
  );
}
