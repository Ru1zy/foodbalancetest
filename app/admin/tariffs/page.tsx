import { getAllTariffs } from "@/app/actions/tariff-impl";
import TariffRow from "./TariffRow";

export default async function TariffsPage() {
  const tariffs = await getAllTariffs();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Управління тарифами</h1>
          <p className="mt-2 text-sm text-gray-600">
            Редагуйте назви, ціни та зображення тарифів
          </p>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Назва
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Калорії
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Ціна (текст)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Базова ціна
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Preview / Detail
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Дії
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tariffs.map((tariff) => (
                  <TariffRow key={tariff.id} tariff={tariff} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {tariffs.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-600">
              Тарифи відсутні. Запустіть seed скрипт або додайте вручну через базу даних.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
