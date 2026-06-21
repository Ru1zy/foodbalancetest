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
