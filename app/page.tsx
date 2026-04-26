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
    <main className="relative min-h-screen overflow-x-hidden">
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8 lg:px-16">
        {/* Hero Section */}
        <div className="mb-16 text-center relative">
          <div className="inline-block mb-6 animate-float">
            <div className="mb-4 flex justify-center">
              <img src="/foodbalancelogo.png" alt="FoodBalance" className="h-32 w-32 object-contain border border-gray-200" />
            </div>
          </div>

          <h1 className="mb-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl md:text-7xl lg:text-8xl">
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient">
              FoodBalance
            </span>
          </h1>

          <p className="text-2xl font-semibold text-slate-700 mb-4">
            Здорове харчування з доставкою
          </p>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
            Оберіть свій ідеальний раціон харчування та отримайте свіжі страви прямо до дверей
          </p>

          {/* Stats */}
          <div className="mb-12 flex flex-wrap items-center justify-center gap-4">
            <div className="rounded-2xl px-8 py-4 border border-gray-200 bg-white hover:border-gray-300">
              <div className="text-3xl font-bold text-gray-900">
                500+
              </div>
              <div className="text-sm text-gray-500 font-medium">Задоволених клієнтів</div>
            </div>
            <div className="rounded-2xl px-8 py-4 border border-gray-200 bg-white hover:border-gray-300">
              <div className="text-3xl font-bold text-gray-900">
                1000+
              </div>
              <div className="text-sm text-gray-500 font-medium">Доставлених страв</div>
            </div>
            <div className="rounded-2xl px-8 py-4 border border-gray-200 bg-white hover:border-gray-300">
              <div className="text-3xl font-bold text-gray-900">
                100%
              </div>
              <div className="text-sm text-gray-500 font-medium">Свіжі продукти</div>
            </div>
          </div>
        </div>

        {/* Menu Section */}
        {menuItems.length === 0 ? (
          <div className="rounded-3xl p-16 text-center border border-gray-200 bg-white">
            <div className="mb-6 animate-float flex justify-center">
              <img src="/foodbalancelogo.png" alt="FoodBalance" className="h-32 w-32 object-contain border border-gray-200" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Меню оновлюється
            </h2>
            <p className="text-lg text-gray-500">Незабаром з’являться нові смачні страви</p>
          </div>
        ) : (
          <div className="rounded-3xl p-8 border border-gray-200 bg-white">
            <OrderWizard menuItems={menuItems} tariffs={tariffs} />
          </div>
        )}
      </section>

      {/* Floating elements */}
      <div className="fixed bottom-10 right-10 rounded-full p-4 border border-gray-200 bg-white hover:border-gray-300 cursor-pointer animate-glow hidden lg:block">
        <span className="text-3xl text-gray-900">💬</span>
      </div>
    </main>
  );
}
