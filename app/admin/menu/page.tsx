import { getAllMenuItems } from "@/app/actions/menu-impl";
import MenuPhotoUpload from "./MenuPhotoUpload";

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
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Управління меню</h1>
          <p className="mt-2 text-sm text-gray-600">
            Завантажте зображення для кожного дня меню
          </p>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    День тижня
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Тариф
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Фото
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {menuItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {dayNames[item.dayOfWeek] || `День ${item.dayOfWeek}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.packageType}
                    </td>
                    <td className="px-6 py-4">
                      <MenuPhotoUpload
                        menuId={item.id}
                        currentPhotoUrl={item.photoUrl}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {menuItems.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-600">
              Меню порожнє. Додайте записи через базу даних або seed скрипт.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
