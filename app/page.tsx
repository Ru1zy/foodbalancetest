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
            <div className="mb-4 drop-shadow-2xl flex justify-center">
              <img src="/foodbalancelogo.png" alt="FoodBalance" className="h-32 w-32 object-contain" />
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
            <div className="glass rounded-2xl px-8 py-4 hover-lift">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                500+
              </div>
              <div className="text-sm text-slate-600 font-medium">Задоволених клієнтів</div>
            </div>
            <div className="glass rounded-2xl px-8 py-4 hover-lift">
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                1000+
              </div>
              <div className="text-sm text-slate-600 font-medium">Доставлених страв</div>
            </div>
            <div className="glass rounded-2xl px-8 py-4 hover-lift">
              <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                100%
              </div>
              <div className="text-sm text-slate-600 font-medium">Свіжі продукти</div>
            </div>
          </div>
        </div>

        {/* Menu Section */}
        {menuItems.length === 0 ? (
          <div className="glass rounded-3xl p-16 text-center shadow-2xl hover-lift">
            <div className="mb-6 animate-float flex justify-center">
              <img src="/foodbalancelogo.png" alt="FoodBalance" className="h-32 w-32 object-contain" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Меню оновляється
            </h2>
            <p className="text-lg text-slate-600">Незабаром з&apos;являться нові смачні страви</p>
          </div>
        ) : (
          <div className="glass rounded-3xl p-8 shadow-2xl">
            <OrderWizard menuItems={menuItems} tariffs={tariffs} />
          </div>
        )}
      </section>

      {/* Floating elements */}
      <div className="fixed bottom-10 right-10 glass rounded-full p-4 shadow-xl hover-lift cursor-pointer animate-glow hidden lg:block">
        <span className="text-3xl">💬</span>
      </div>
    </main>
  );
}
