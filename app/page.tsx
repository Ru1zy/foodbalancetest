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
    <main className="flex-grow flex flex-col">
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:px-8 lg:px-16">
        {/* Menu Section */}
        {menuItems.length === 0 ? (
          <div className="rounded-3xl p-16 text-center border border-gray-200 bg-white">
            <div className="mb-6 flex justify-center">
              <img src="/foodbalancelogo.png" alt="Food Balance" className="h-32 w-32 object-contain border border-gray-200" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Меню оновлюється
            </h2>
            <p className="text-lg text-gray-500">Незабаром з’являться нові смачні страви</p>
          </div>
        ) : (
          <OrderWizard menuItems={menuItems} tariffs={tariffs} />
        )}
      </section>
    </main>
  );
}
