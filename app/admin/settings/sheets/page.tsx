import { getAllSheetConfigs } from "@/app/actions/sheet-config-impl";
import {
  getGoogleDriveConnectionStatus,
  getUpcomingMonthKey,
} from "@/lib/google-drive";
import GoogleDriveAutomation from "./GoogleDriveAutomation";
import SheetConfigManager from "./SheetConfigManager";
import AdminHelpBanner from "@/components/admin/AdminHelpBanner";

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

        <AdminHelpBanner
          id="sheets"
          title="Підключення щомісячних Google Таблиць"
          description="Словник щомісячних таблиць замовлень. Кожен місяць має власну Google Таблицю (формат MM.YYYY), куди експортуються замовлення."
          items={[
            {
              icon: "🔑",
              title: "Ключ місяця (MM.YYYY)",
              text: "Вказуйте місяць і рік, наприклад: 09.2026. Замовлення автоматично розподіляються в потрібну таблицю за датою доставки.",
            },
            {
              icon: "🤖",
              title: "Автоматизація Drive",
              text: "Якщо Google Drive підключено (блок вище), система автоматично створює нову таблицю на наступний місяць з майстер-шаблону.",
            },
            {
              icon: "📧",
              title: "Сервісний Google-акаунт",
              text: `Надайте права 'Редактор' сервісному акаунту: ${process.env.GOOGLE_CLIENT_EMAIL || "сервісному акаунту FoodBalance"}.`,
            },
            {
              icon: "📑",
              title: "Шаблон аркуша (_Template)",
              text: "У таблиці має бути лист з точним ім'ям '_Template'. З нього система клонує щоденні аркуші (наприклад, 19.04).",
            },
            {
              icon: "📋",
              title: "Структура колонок B–K",
              text: "Замовлення записуються з рядка 5: №, ПІБ, телефон, адреса, Telegram Chat ID, пакет, страви, прилади, коментар, ціна.",
            },
            {
              icon: "🔗",
              title: "Додавання таблиці",
              text: "Вставте посилання або Spreadsheet ID у форму нижче та вкажіть місяць у форматі MM.YYYY.",
            },
          ]}
          tips={[
            "FoodBalance сам створить денну вкладку DD.MM копіюванням _Template, якщо вона ще не існує.",
            "Дата денної вкладки автоматично записується в клітинку B2 створеного аркуша.",
          ]}
        />

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
