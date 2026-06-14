import prisma from "@/lib/prisma";
import type { Menu } from "@prisma/client";
import { mealSuffix, PackageType } from "@/lib/order-logic";
import {
  isIndivPackage,
  type IndivDishQuantity,
} from "@/lib/order-selection";

type TelegramOrder = {
  cutlery: number;
  deliveryAddress: string | null;
  items: unknown;
  notes: string | null;
  packageType: string;
};

type TelegramUser = {
  address: string | null;
  name: string;
  notes: string | null;
  phone: string;
};

type CartDay = {
  dayId: string;
  items?: IndivDishQuantity[];
  selectedCount: number;
  selections?: Record<string, number>;
};

type DishOption = {
  full: string;
  short: string;
};

type Dishes = {
  breakfast: DishOption[];
  dinner: DishOption[];
  extra?: DishOption[];
  lunch: DishOption[];
  snack?: DishOption[];
};

type MenuRecord = {
  dayOfWeek: number;
  dishes: Dishes;
  id: string;
  packageType: string;
};

const DAY_NAMES: Record<number, string> = {
  1: "Понеділок",
  2: "Вівторок",
  3: "Середа",
  4: "Четвер",
  5: "П’ятниця",
  6: "Субота",
  7: "Неділя",
};

const CATEGORY_LABELS: Record<string, string> = {
  breakfast: "Сніданок",
  dinner: "Вечеря",
  extra: "Додаткова страва",
  lunch: "Обід",
  snack: "Перекус",
};

const CATEGORY_ORDER = ["breakfast", "lunch", "dinner", "snack", "extra"];

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDishWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "страва";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "страви";
  }

  return "страв";
}

function normalizeDish(dish: DishOption, suffix = "") {
  return {
    full: suffix ? `${dish.full}${suffix}` : dish.full,
    short: suffix ? `${dish.short}${suffix}` : dish.short,
  };
}

function normalizeDishes(rawDishes: unknown): Dishes {
  if (!rawDishes || typeof rawDishes !== "object") {
    return { breakfast: [], lunch: [], dinner: [], snack: [] };
  }

  const source = rawDishes as Partial<Dishes>;

  return {
    breakfast: Array.isArray(source.breakfast) ? source.breakfast : [],
    lunch: Array.isArray(source.lunch) ? source.lunch : [],
    dinner: Array.isArray(source.dinner) ? source.dinner : [],
    snack: Array.isArray(source.snack) ? source.snack : [],
    extra: Array.isArray(source.extra) ? source.extra : undefined,
  };
}

function transformMenuForPackage(item: MenuRecord, packageType: PackageType): MenuRecord {
  if (packageType === "Sushka" || item.packageType !== "Template") {
    return item;
  }

  const breakfast = item.dishes.breakfast.map((dish) => normalizeDish(dish));
  const lunch = item.dishes.lunch.map((dish) => normalizeDish(dish, mealSuffix(packageType, "lunch")));
  const dinner = item.dishes.dinner.map((dish) => normalizeDish(dish, mealSuffix(packageType, "dinner")));
  const snack = packageType === "Slim" ? [] : item.dishes.snack?.map((dish) => normalizeDish(dish)) || [];
  const extra = packageType === "Sport" ? [...breakfast, ...lunch, ...dinner, ...snack] : undefined;

  return {
    ...item,
    dishes: {
      breakfast,
      lunch,
      dinner,
      snack,
      extra,
    },
  };
}

function extractCartDays(items: unknown): CartDay[] {
  if (!items || typeof items !== "object" || !("days" in items)) {
    return [];
  }

  const rawDays = (items as { days?: unknown }).days;

  if (!Array.isArray(rawDays)) {
    return [];
  }

  return rawDays
    .filter((day): day is CartDay => {
      if (!day || typeof day !== "object") {
        return false;
      }

      const candidate = day as {
        dayId?: unknown;
        items?: unknown;
        selectedCount?: unknown;
        selections?: unknown;
      };
      const hasSelections =
        !!candidate.selections &&
        typeof candidate.selections === "object" &&
        !Array.isArray(candidate.selections);
      const hasItems = Array.isArray(candidate.items);

      return (
        typeof candidate.dayId === "string" &&
        (candidate.dayId || "").trim().length > 0 &&
        typeof candidate.selectedCount === "number" &&
        Number.isFinite(candidate.selectedCount) &&
        (hasSelections || hasItems)
      );
    })
    .map((day) => ({
      dayId: day.dayId,
      items: Array.isArray(day.items) ? day.items : undefined,
      selectedCount: day.selectedCount,
      selections: day.selections,
    }));
}

async function formatDays(items: unknown, packageType: PackageType) {
  const cartDays = extractCartDays(items);

  if (cartDays.length === 0) {
    return "• Немає даних про дні";
  }

  const menuItems = await prisma.menu.findMany({
    where: {
      id: {
        in: cartDays.map((day) => day.dayId),
      },
    },
    select: {
      dayOfWeek: true,
      dishes: true,
      id: true,
      packageType: true,
    },
  });

  const menuById = new Map(
    menuItems.map((item: Pick<Menu, "id" | "dayOfWeek" | "dishes" | "packageType">) => [
      item.id,
      transformMenuForPackage(
        {
          dayOfWeek: item.dayOfWeek,
          dishes: normalizeDishes(item.dishes),
          id: item.id,
          packageType: item.packageType,
        },
        packageType,
      ),
    ]),
  );

  return cartDays
    .sort((left, right) => {
      const leftDay = menuById.get(left.dayId)?.dayOfWeek ?? 99;
      const rightDay = menuById.get(right.dayId)?.dayOfWeek ?? 99;
      return leftDay - rightDay;
    })
    .map((day, index) => {
      const menu = menuById.get(day.dayId);
      const dayName = DAY_NAMES[menu?.dayOfWeek ?? 0] || `День ${index + 1}`;
      
      const isCustomOrIndiv = isIndivPackage(packageType) || (day.items && day.items.length > 0);

      const dishes = isCustomOrIndiv
        ? (day.items ?? []).flatMap((item) => {
            const dishId = item.dishId || "";
            const quantity = item.quantity || 1;
            const separatorIndex = dishId.lastIndexOf(":");
            
            let dishName = dishId;
            let categoryLabel = "";

            if (separatorIndex > 0) {
              const cat = dishId.slice(0, separatorIndex);
              const idx = parseInt(dishId.slice(separatorIndex + 1));
              categoryLabel = CATEGORY_LABELS[cat] || cat;
              
              const selectedDish = menu?.dishes[cat as keyof Dishes]?.[idx];
              if (selectedDish) {
                dishName = selectedDish.full;
              } else {
                dishName = `${categoryLabel} №${idx + 1}`;
              }
            }

            return [`&nbsp;&nbsp;• ${categoryLabel ? `<b>${escapeHtml(categoryLabel)}:</b> ` : ""}${escapeHtml(dishName)} (x${quantity})`];
          })
        : CATEGORY_ORDER.flatMap((category) => {
            const selectedIndex = day.selections?.[category];

            if (selectedIndex === undefined) {
              return [];
            }

            const selectedDish = menu?.dishes[category as keyof Dishes]?.[selectedIndex];
            const label = CATEGORY_LABELS[category] || category;

            if (!selectedDish) {
              return [`&nbsp;&nbsp;• <b>${escapeHtml(label)}:</b> Невідомий вибір (#${selectedIndex + 1})`];
            }

            return [`&nbsp;&nbsp;• <b>${escapeHtml(label)}:</b> ${escapeHtml(selectedDish.full)}`];
          });

      return [
        `• <b>${escapeHtml(dayName)}</b> — ${day.selectedCount} ${formatDishWord(day.selectedCount)}`,
        ...dishes,
      ].join("\n");
    })
    .join("\n");
}

export async function sendOrderNotification(order: TelegramOrder, user: TelegramUser) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !adminChatId) {
    throw new Error("Telegram environment variables are not configured.");
  }

  const adminIds = adminChatId.split(",").map((id) => id.trim());
  const daysText = await formatDays(order.items, order.packageType as PackageType);
  const message = [
    "🚨 <b>Нове замовлення!</b>",
    `👤 <b>Клієнт:</b> ${escapeHtml(user.name || "Клієнт")} (${escapeHtml(user.phone)})`,
    `📦 <b>Пакет:</b> ${escapeHtml(order.packageType)}`,
    `📍 <b>Адреса:</b> ${escapeHtml(user.address || "Не вказано")}`,
    `🍴 <b>Прибори:</b> ${escapeHtml(order.cutlery || "Не вказано")}`,
    `💬 <b>Коментар:</b> ${escapeHtml(order.notes || user.notes || "Без коментаря")}`,
    `📅 <b>Дні:</b>\n${daysText}`,
  ].join("\n").replace(/&nbsp;/g, ' ');

  const sendPromises = adminIds.map((chatId) =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        parse_mode: "HTML",
        text: message,
      }),
    }).then(async (response) => {
      if (!response.ok) {
        console.error(`Telegram sendMessage failed for ${chatId}: ${await response.text()}`);
      }
    })
  );

  await Promise.all(sendPromises);
}

type OrderDetails = {
  date: Date;
  pkg: string;
};

function formatDeliveryDate(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Kyiv",
  }).format(date);
}

export async function sendPaymentConfirmation(chatId: string, orderDetails: OrderDetails): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set");
    return;
  }

  const formattedDate = formatDeliveryDate(orderDetails.date);
  const text = `✅ <b>Оплату отримано. Замовлення підтверджено!</b>

📅 На дату: ${formattedDate}
Тариф: ${escapeHtml(orderDetails.pkg)}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Telegram API error:", errorData);
    }
  } catch (error) {
    console.error("Failed to send Telegram notification:", error);
  }
}
