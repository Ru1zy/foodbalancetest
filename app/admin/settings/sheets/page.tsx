import { getAllSheetConfigs } from "@/app/actions/sheet-config-impl";
import SheetConfigManager from "./SheetConfigManager";

// Admin auth is enforced by app/admin/layout.tsx (getAuthenticatedAdminUser)
// and again inside every mutating server action in sheet-config-impl.ts.
export default async function SheetSettingsPage() {
  const configs = await getAllSheetConfigs();

  return (
    <div className="min-h-[100dvh] bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Налаштування таблиць замовлень</h1>
          <p className="mt-2 text-sm text-gray-600">
            Словник місячних Google-таблиць для експорту замовлень. Кожен місяць має власну таблицю,
            ідентифіковану ключем <code className="rounded bg-gray-100 px-1 py-0.5 text-gray-800">MM.YYYY</code>.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-slate-700">
          <h2 className="font-bold text-slate-900">Як підготувати таблицю на новий місяць</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>Створіть окрему Google-таблицю для потрібного місяця.</li>
            <li>
              Надайте сервісному Google-акаунту FoodBalance права
              редактора.
            </li>
            <li>
              Створіть у ній лист із точним іменем{" "}
              <code className="rounded bg-white px-1 py-0.5 text-slate-900">_Template</code>.
              Заголовки та форматування можна оформити як потрібно;
              замовлення записуються з рядка 5 у колонки B–K.
            </li>
            <li>
              Колонки B–K: №, ім’я, телефон, адреса, Telegram Chat ID,
              пакет, страви, прибори, коментар, ціна. Дата денної
              вкладки автоматично записується в B2.
            </li>
            <li>
              Вставте URL цієї книги нижче та вкажіть місяць у форматі{" "}
              <code className="rounded bg-white px-1 py-0.5 text-slate-900">MM.YYYY</code>.
            </li>
          </ol>
          <p className="mt-3 text-xs text-slate-600">
            FoodBalance сам створить вкладку <code>DD.MM</code> копіюванням{" "}
            <code>_Template</code>, якщо вона ще не існує.
          </p>
        </div>

        <SheetConfigManager
          configs={configs.map((c) => ({
            id: c.id,
            monthKey: c.monthKey,
            spreadsheetId: c.spreadsheetId,
            label: c.label,
          }))}
        />
      </div>
    </div>
  );
}
