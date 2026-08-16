import { getAllTariffs } from "@/app/actions/tariff-impl";
import TariffRow from "./TariffRow";

export default async function TariffsPage() {
  const tariffs = await getAllTariffs();

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-950 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Управління тарифами</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
            Редагуйте назви, ціни та зображення тарифів
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-slate-400">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-slate-400">
                    Назва
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-slate-400">
                    Калорії
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-slate-400">
                    Ціна (текст)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-slate-400">
                    Базова ціна
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-slate-400">
                    Preview / Detail
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-slate-400">
                    Дії
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tariffs.map((tariff: Awaited<ReturnType<typeof getAllTariffs>>[number]) => (
                  <TariffRow key={tariff.id} tariff={tariff} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {tariffs.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-950 p-8 text-center">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Тарифи відсутні. Запустіть seed скрипт або додайте вручну через базу даних.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
