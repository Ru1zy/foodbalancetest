import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAuthToken } from "@/lib/auth-token";
import prisma from "@/lib/prisma";
import ProfilePageClient, { type OrderWithResolvedDishes } from "./ProfilePageClient";
import { parseCutleryCount } from "@/lib/checkout";

const CATEGORY_LABELS: Record<string, string> = {
  breakfast: "Сніданок",
  lunch: "Обід",
  dinner: "Вечеря",
  snack: "Перекус",
};

async function resolveOrderDishes(order: any): Promise<string[]> {
  if (!order.items || typeof order.items !== "object") {
    return [];
  }

  const days = (order.items as Record<string, unknown>).days;
  if (!Array.isArray(days) || days.length === 0) {
    return [];
  }

  // Collect all unique dayIds
  const dayIds = days
    .map((day: any) => day?.dayId)
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

  // Resolve dish names
  const allDishes: string[] = [];

  for (const day of days) {
    // Handle individual package items (Indiv package)
    if (Array.isArray(day.items)) {
      for (const item of day.items) {
        const dishId = item.dishId || "";
        const quantity = item.quantity || 1;
        allDishes.push(`${dishId} (x${quantity})`);
      }
    }

    // Handle standard package selections
    if (day.selections && typeof day.selections === "object" && day.dayId) {
      const menu = menuById.get(day.dayId);

      if (!menu) {
        continue;
      }

      const dishes = typeof menu.dishes === "string" ? JSON.parse(menu.dishes) : menu.dishes;

      Object.entries(day.selections).forEach(([category, selectionIndex]) => {
        const categoryLabel = CATEGORY_LABELS[category] || category;
        const categoryDishes = dishes[category];

        if (Array.isArray(categoryDishes) && typeof selectionIndex === "number" && categoryDishes[selectionIndex]) {
          const dish = categoryDishes[selectionIndex];
          const dishName =
            typeof dish === "object" && dish !== null
              ? dish.full || dish.short || dish.name
              : dish;

          if (dishName) {
            allDishes.push(`${categoryLabel}: ${String(dishName).trim()}`);
          } else {
            allDishes.push(`${categoryLabel}: Страва не знайдена`);
          }
        } else {
          allDishes.push(`${categoryLabel}: Страва не знайдена`);
        }
      });
    }
  }

  return allDishes;
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
      status: order.status,
      packageType: order.packageType,
      price: order.price,
      isPaid: order.isPaid,
      resolvedDishes: await resolveOrderDishes(order),
    }))
  );

  return <ProfilePageClient user={user} orders={ordersWithResolvedDishes} />;
}