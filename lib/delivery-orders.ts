import "server-only";

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type OrderWithUser = Prisma.OrderGetPayload<{ include: { user: true } }>;

export type DeliveryOrderWithUser = OrderWithUser & {
  orderDayId: string | null;
  orderDayStatus: string | null;
  orderDayItems: Prisma.JsonValue | null;
  menuSnapshot: Prisma.JsonValue | null;
  originalDeliveryDate: Date;
};

type DeliveryOrderQueryOptions = {
  paidOnly?: boolean;
  excludedOrderStatuses?: string[];
};

/**
 * Return one row per concrete delivery occurrence.
 *
 * Orders created before OrderDay was introduced remain visible on their legacy
 * first delivery date until the backfill has populated their child rows.
 */
export async function findDeliveryOrdersForRange(
  start: Date,
  end: Date,
  options: DeliveryOrderQueryOptions = {},
): Promise<DeliveryOrderWithUser[]> {
  const excludedOrderStatuses = options.excludedOrderStatuses ?? ["cancelled"];
  const parentWhere: Prisma.OrderWhereInput = {
    status: { notIn: excludedOrderStatuses },
    ...(options.paidOnly ? { isPaid: true } : {}),
  };

  const [dayRows, legacyOrders] = await Promise.all([
    prisma.orderDay.findMany({
      where: {
        deliveryDate: { gte: start, lte: end },
        status: { not: "cancelled" },
        order: parentWhere,
      },
      include: {
        order: {
          include: { user: true },
        },
      },
      orderBy: {
        order: { createdAt: "desc" },
      },
    }),
    prisma.order.findMany({
      where: {
        ...parentWhere,
        days: { none: {} },
        deliveryDate: { gte: start, lte: end },
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const normalizedDays: DeliveryOrderWithUser[] = dayRows.map((day) => ({
    ...day.order,
    deliveryDate: day.deliveryDate,
    deliveryTime: day.deliveryTime,
    deliveryNote: day.deliveryNote,
    orderDayId: day.id,
    orderDayStatus: day.status,
    orderDayItems: day.items,
    menuSnapshot: day.menuSnapshot,
    originalDeliveryDate: day.order.deliveryDate,
  }));

  const normalizedLegacy: DeliveryOrderWithUser[] = legacyOrders.map((order) => ({
    ...order,
    orderDayId: null,
    orderDayStatus: null,
    orderDayItems: null,
    menuSnapshot: null,
    originalDeliveryDate: order.deliveryDate,
  }));

  return [...normalizedDays, ...normalizedLegacy].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
}
