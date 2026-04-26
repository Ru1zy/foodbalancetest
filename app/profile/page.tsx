import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAuthToken } from "@/lib/auth-token";
import prisma from "@/lib/prisma";
import ProfilePageClient, { type OrderWithResolvedDishes, type ResolvedDay } from "./ProfilePageClient";
import { parseCutleryCount } from "@/lib/checkout";
import { sanitizeTelegramPhone } from "@/lib/telegram-phone";

const CATEGORY_LABELS: Record<string, string> = {
  breakfast: "Сніданок",
  lunch: "Обід",
  dinner: "Вечеря",
  snack: "Перекус",
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

  const menuById = new Map(menus.map((menu) => [menu.id, menu]));

  // Resolve dish names per day
  const resolvedDays: ResolvedDay[] = [];

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    const dayDishes: string[] = [];

    // Calculate actual date for this day
    const actualDate = new Date(order.deliveryDate);
    actualDate.setDate(actualDate.getDate() + dayIndex);

    // Handle individual package items (Indiv package)
    if (Array.isArray(day?.items)) {
      for (const item of day.items) {
        const dishId = item.dishId || "";
        const quantity = typeof item.quantity === "number" ? item.quantity : 1;
        dayDishes.push(`${dishId} (x${quantity})`);
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

  const user = {
    ...dbUser,
    defaultCutlery: parseCutleryCount(dbUser.defaultCutlery),
    phone: sanitizeTelegramPhone(dbUser.phone),
  };

  const rawOrders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  // Resolve dish names for all orders
  const ordersWithResolvedDishes: OrderWithResolvedDishes[] = await Promise.all(
    rawOrders.map(async (order) => ({
      id: order.id,
      createdAt: order.createdAt,
      deliveryDate: order.deliveryDate,
      packageType: order.packageType,
      price: order.price,
      isPaid: order.isPaid,
      resolvedDays: await resolveOrderDishes(order),
    }))
  );

  return <ProfilePageClient user={user} orders={ordersWithResolvedDishes} />;
}
