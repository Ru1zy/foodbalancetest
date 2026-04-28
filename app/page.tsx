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
        {/* Hero Section */}
        <div className="mb-16 text-center relative">
          <div className="inline-block mb-6">
            <div className="mb-4 flex justify-center">
              <img src="/foodbalancelogo.png" alt="Food Balance" className="h-32 w-32 object-contain drop-shadow-sm mix-blend-multiply" />
            </div>
          </div>

          <h1 className="mb-6 text-4xl sm:text-5xl md:text-6xl font-black leading-tight tracking-tighter drop-shadow-md">
            <span className="bg-gradient-to-b from-emerald-400 to-emerald-600 bg-clip-text text-transparent">Food</span> <span className="bg-gradient-to-b from-orange-400 to-orange-600 bg-clip-text text-transparent">Balance</span>
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600 mb-4">
            Здорове харчування з доставкою
          </p>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
            Оберіть свій ідеальний раціон харчування та отримайте свіжі страви прямо до дверей
          </p>

          {/* Stats */}
          <div className="mb-12 flex flex-wrap items-center justify-center gap-4">
            <div className="rounded-2xl px-8 py-4 border border-slate-100 bg-white shadow-md hover:border-gray-300">
              <div className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-green-400 bg-clip-text text-transparent">
                500+
              </div>
              <div className="text-sm text-gray-500 font-medium">Задоволених клієнтів</div>
            </div>
            <div className="rounded-2xl px-8 py-4 border border-slate-100 bg-white shadow-md hover:border-gray-300">
              <div className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-green-400 bg-clip-text text-transparent">
                1000+
              </div>
              <div className="text-sm text-gray-500 font-medium">Доставлених страв</div>
            </div>
            <div className="rounded-2xl px-8 py-4 border border-slate-100 bg-white shadow-md hover:border-gray-300">
              <div className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-green-400 bg-clip-text text-transparent">
                100%
              </div>
              <div className="text-sm text-gray-500 font-medium">Свіжі продукти</div>
            </div>
          </div>
        </div>

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
