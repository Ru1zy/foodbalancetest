import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

function getCartDays(items) {
  if (!items || typeof items !== "object" || !Array.isArray(items.days)) {
    return null;
  }

  const days = items.days.filter(
    (day) => day && typeof day === "object" && typeof day.dayId === "string" && day.dayId.trim(),
  );
  return days.length === items.days.length && days.length > 0 ? days : null;
}

function addUtcDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function main() {
  const orders = await prisma.order.findMany({
    where: { days: { none: {} } },
    select: {
      id: true,
      deliveryDate: true,
      deliveryTime: true,
      deliveryNote: true,
      status: true,
      items: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const parsed = orders.map((order) => ({ order, days: getCartDays(order.items) }));
  const menuIds = [
    ...new Set(
      parsed.flatMap(({ days }) => (days ?? []).map((day) => day.dayId.trim())),
    ),
  ];
  const menus = await prisma.menu.findMany({
    where: { id: { in: menuIds } },
    select: { id: true, dayOfWeek: true, dishes: true },
  });
  const menuById = new Map(menus.map((menu) => [menu.id, menu]));

  const rows = [];
  const skipped = [];
  for (const { order, days } of parsed) {
    if (!days) {
      skipped.push({ orderId: order.id, reason: "invalid legacy items" });
      continue;
    }

    const resolved = days.map((day) => ({ day, menu: menuById.get(day.dayId.trim()) }));
    if (
      resolved.some(
        ({ menu }) =>
          !menu || !Number.isInteger(menu.dayOfWeek) || menu.dayOfWeek < 1 || menu.dayOfWeek > 7,
      )
    ) {
      skipped.push({ orderId: order.id, reason: "menu row missing or invalid" });
      continue;
    }

    const weekdays = resolved.map(({ menu }) => menu.dayOfWeek);
    if (new Set(weekdays).size !== weekdays.length) {
      skipped.push({ orderId: order.id, reason: "duplicate delivery weekday" });
      continue;
    }

    const firstWeekday = Math.min(...weekdays);
    for (const { day, menu } of resolved) {
      rows.push({
        orderId: order.id,
        deliveryDate: addUtcDays(order.deliveryDate, menu.dayOfWeek - firstWeekday),
        weekday: menu.dayOfWeek,
        menuId: menu.id,
        items: day,
        menuSnapshot: menu.dishes === null ? Prisma.JsonNull : menu.dishes,
        status: order.status === "cancelled" ? "cancelled" : "scheduled",
        deliveryTime: order.deliveryTime,
        deliveryNote: order.deliveryNote,
      });
    }
  }

  console.log(
    JSON.stringify({ mode: apply ? "apply" : "dry-run", orders: orders.length, rows: rows.length, skipped }),
  );

  if (!apply || rows.length === 0) {
    return;
  }

  const result = await prisma.orderDay.createMany({ data: rows, skipDuplicates: true });
  const remaining = await prisma.order.count({ where: { days: { none: {} } } });
  console.log(JSON.stringify({ inserted: result.count, remainingOrdersWithoutDays: remaining }));
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
