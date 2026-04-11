import OrderWizard from "./OrderWizard";
import prisma from "../lib/prisma";

async function getMenuItems() {
  try {
    const menuItems = await prisma.menu.findMany();
    return menuItems.map((item) => ({
      ...item,
      dayOfWeek: item.dayOfWeek || 0,
      packageType: (item.packageType as string) || "Standard",
      photoUrl: item.photoUrl || null,
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

async function getTariffs() {
  try {
    const tariffs = await prisma.tariff.findMany({
      orderBy: { name: "asc" },
    });
    return tariffs;
  } catch (error) {
    console.error("Error fetching tariffs:", error);
    return [];
  }
}

export default async function Home() {
  const menuItems = await getMenuItems();
  const tariffs = await getTariffs();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Delivery CRM — Меню
          </h1>
          <p className="text-lg text-slate-600">
            Оберіть свій ідеальний раціон харчування
          </p>
        </div>

        {menuItems.length === 0 ? (
          <div className="rounded-2xl bg-white/80 backdrop-blur-sm p-12 text-center shadow-xl ring-1 ring-slate-200/60">
            <div className="text-6xl mb-4">🍽️</div>
            <p className="text-lg font-semibold text-slate-700">Меню оновляється</p>
            <p className="text-sm text-slate-500 mt-2">Незабаром з'являться нові страви</p>
          </div>
        ) : (
          <OrderWizard menuItems={menuItems} tariffs={tariffs} />
        )}
      </section>
    </main>
  );
}
