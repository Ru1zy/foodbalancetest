import { getAllMenuItems } from "@/app/actions/menu-impl";
import { MenuItem } from "@/lib/menu-types";
import MenuPhotoUpload from "./MenuPhotoUpload";
import MenuDishesEditor from "./MenuDishesEditor";
import AdminHelpBanner from "@/components/admin/AdminHelpBanner";

const dayNames: Record<number, string> = {
  1: "Понеділок",
  2: "Вівторок",
  3: "Середа",
  4: "Четвер",
  5: "П'ятниця",
  6: "Субота",
  7: "Неділя",
};

export default async function AdminMenuPage() {
  const menuItems = await getAllMenuItems();

  return (
    <main className="min-h-[100dvh] bg-gray-50 dark:bg-slate-950 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Управління меню</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
            Завантажте зображення та редагуйте страви для кожного дня меню
          </p>
        </div>

        <AdminHelpBanner
          id="menu"
          title="Керування щотижневим меню та стравами"
          description="Налаштування 7-денного циклу раціонів харчування, редагування страв та завантаження фотографій."
          items={[
            {
              icon: "📅",
              title: "Цикл 7 днів",
              text: "Меню розбито за днями тижня (Понеділок — Неділя). На сайті автоматично відображаються страви поточного дня.",
            },
            {
              icon: "🥗",
              title: "Тарифи раціонів",
              text: "Кожен день налаштовується під конкретний пакет харчування (наприклад, Template або Sushka) з відповідною калорійністю.",
            },
            {
              icon: "📸",
              title: "Фотографії дня",
              text: "Завантажуйте соковиті та апетитні фото готових страв для наочної презентації клієнтам у каруселі меню.",
            },
            {
              icon: "🍲",
              title: "Редактор страв",
              text: "Натискайте 'Редагувати страви', щоб додавати, перейменовувати або змінювати назви сніданків, обідів, вечерь та перекусів.",
            },
            {
              icon: "🚀",
              title: "Миттєве оновлення",
              text: "Будь-які зміни страв чи фото негайно стають видимими відвідувачам сайту та користувачам бота.",
            },
          ]}
          tips={[
            "Рекомендоване співвідношення сторін для фотографій страв: 16:9 або 4:3 для найкращого вигляду на смартфонах.",
          ]}
        />

        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-gray-200 dark:ring-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-slate-400">
                    День тижня
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-slate-400">
                    Тариф
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-slate-400">
                    Фото
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-slate-400">
                    Страви
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {menuItems.map((item: MenuItem) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:bg-slate-950">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-slate-100">
                      {dayNames[item.dayOfWeek] || `День ${item.dayOfWeek}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">
                      {item.packageType}
                    </td>
                    <td className="px-6 py-4">
                      <MenuPhotoUpload
                        menuId={item.id}
                        currentPhotoUrl={item.photoUrl || null}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <MenuDishesEditor
                        menuId={item.id}
                        currentDishes={item.dishes}
                        packageType={item.packageType}
                        dayOfWeek={item.dayOfWeek}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {menuItems.length === 0 && (
          <div className="mt-8 rounded-2xl border border-solid border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-950 p-8 text-center">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Меню порожнє. Додайте записи через базу даних або seed скрипт.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
