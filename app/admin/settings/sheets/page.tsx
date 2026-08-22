import { getAllSheetConfigs } from "@/app/actions/sheet-config-impl";
import {
  getGoogleDriveConnectionStatus,
  getUpcomingMonthKey,
} from "@/lib/google-drive";
import GoogleDriveAutomation from "./GoogleDriveAutomation";
import SheetConfigManager from "./SheetConfigManager";

type SearchParams = Promise<{
  drive?: string;
  drive_error?: string;
  drive_warning?: string;
}>;

function connectionNotice(params: Awaited<SearchParams>) {
  if (params.drive_error) {
    const messages: Record<string, string> = {
      access_denied: "Доступ до Google Drive не надано.",
      connection_failed: "Не вдалося підключити Google Drive. Перевірте налаштування та Railway logs.",
      invalid_state: "Сесію підключення втрачено. Спробуйте ще раз.",
      missing_code: "Google не повернув код авторизації. Спробуйте ще раз.",
    };
    return {
      tone: "error" as const,
      text: messages[params.drive_error] || "Не вдалося підключити Google Drive.",
    };
  }
  if (params.drive_warning) {
    return {
      tone: "warning" as const,
      text: "Google Drive підключено, але таблицю наступного місяця не вдалося створити автоматично.",
    };
  }
  if (params.drive === "connected") {
    return {
      tone: "success" as const,
      text: "Google Drive підключено. Папку, шаблон і таблицю наступного місяця перевірено.",
    };
  }
  return null;
}

// Admin auth is enforced by app/admin/layout.tsx (getAuthenticatedAdminUser)
// and again inside every mutating server action in sheet-config-impl.ts.
export default async function SheetSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [configs, driveStatus, params] = await Promise.all([
    getAllSheetConfigs(),
    getGoogleDriveConnectionStatus(),
    searchParams,
  ]);

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-950 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Налаштування таблиць замовлень</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
            Словник місячних Google-таблиць для експорту замовлень. Кожен місяць має власну таблицю,
            ідентифіковану ключем <code className="rounded bg-gray-100 dark:bg-slate-800 px-1 py-0.5 text-gray-800 dark:text-slate-200">MM.YYYY</code>.
          </p>
        </div>

        <GoogleDriveAutomation
          status={driveStatus}
          nextMonthKey={getUpcomingMonthKey()}
          notice={connectionNotice(params)}
        />

        <div className="mb-6 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-slate-800/50 p-5 text-sm text-slate-700 dark:text-slate-300">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">Ручний резервний варіант</h2>
          <p className="mt-2">
            Потрібен лише якщо автоматизація Google Drive не підключена або тимчасово недоступна.
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>Створіть окрему Google-таблицю для потрібного місяця.</li>
            <li>
              Надайте сервісному Google-акаунту FoodBalance права
              редактора.
            </li>
            <li>
              Створіть у ній лист із точним іменем{" "}
              <code className="rounded bg-white dark:bg-slate-900 px-1 py-0.5 text-slate-900 dark:text-slate-100">_Template</code>.
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
              <code className="rounded bg-white dark:bg-slate-900 px-1 py-0.5 text-slate-900 dark:text-slate-100">MM.YYYY</code>.
            </li>
          </ol>
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
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
