import OrderingWizardClient from "./OrderingWizardClient";
import prisma from "../lib/prisma";

async function getMenuItems() {
  try {
    const menuItems = await prisma.menu.findMany();
    return menuItems.map((item) => ({
      ...item,
      dayOfWeek: item.dayOfWeek || 0,
      packageType: (item.packageType as string) || "Standard",
      dishes:
        typeof item.dishes === "string"
          ? JSON.parse(item.dishes)
          : item.dishes || { breakfast: [], lunch: [], dinner: [], snack: [] },
    }));
  } catch (error) {
    console.error("Error fetching menu items:", error);
    return [];
  }
}

export default async function Home() {
  const menuItems = await getMenuItems();

  return (
    <main className="min-h-screen bg-gray-100 text-gray-800">
      <section className="mx-auto max-w-6xl p-4">
        <h1 className="mb-4 text-3xl font-bold">Delivery CRM — Меню</h1>

        {menuItems.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
            Меню обновляется
          </div>
        ) : (
          <OrderingWizardClient menuItems={menuItems} />
        )}
      </section>
    </main>
  );
}
