import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Date parameter required" }, { status: 400 });
    }

    // Parse date and get start/end of day
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Fetch paid orders for the date
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: startDate,
          lte: endDate,
        },
        isPaid: true,
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Build CSV with UTF-8 BOM for Excel
    let csv = "\uFEFF"; // UTF-8 BOM
    csv += "Клієнт,Телефон,Тариф,Адреса,Страви\n";

    for (const order of orders) {
      const client = `"${order.user.name || "Невідомо"}"`;
      const phone = `"${order.user.phone || ""}"`;
      const tariff = `"${order.packageType || ""}"`;
      const address = `"${(order.deliveryAddress || "").replace(/,/g, ";")}"`; // Replace commas with semicolons

      // Parse items JSON and format
      let items = "";
      try {
        const itemsData = typeof order.items === "string" ? JSON.parse(order.items) : order.items;

        if (itemsData && typeof itemsData === "object") {
          const itemsList: string[] = [];

          // Handle different item formats
          if (Array.isArray(itemsData)) {
            itemsList.push(...itemsData.map((item: any) => String(item).replace(/,/g, ";")));
          } else if (itemsData.days && Array.isArray(itemsData.days)) {
            // Format: {days: [{selections: {...}}, ...]}
            itemsData.days.forEach((day: any) => {
              if (day.selections) {
                Object.entries(day.selections).forEach(([meal, dishes]: [string, any]) => {
                  if (Array.isArray(dishes)) {
                    dishes.forEach((dish: any) => {
                      const dishName = typeof dish === "string" ? dish : dish.name || "";
                      if (dishName) itemsList.push(dishName.replace(/,/g, ";"));
                    });
                  }
                });
              }
            });
          } else {
            // Generic object format
            Object.values(itemsData).forEach((value: any) => {
              if (typeof value === "string") {
                itemsList.push(value.replace(/,/g, ";"));
              } else if (Array.isArray(value)) {
                value.forEach((item: any) => {
                  const str = typeof item === "string" ? item : item.name || "";
                  if (str) itemsList.push(str.replace(/,/g, ";"));
                });
              }
            });
          }

          items = `"${itemsList.join("; ")}"`;
        }
      } catch (error) {
        console.error("Failed to parse items:", error);
        items = `"${String(order.items).replace(/,/g, ";")}"`;
      }

      csv += `${client},${phone},${tariff},${address},${items}\n`;
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kitchen-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
