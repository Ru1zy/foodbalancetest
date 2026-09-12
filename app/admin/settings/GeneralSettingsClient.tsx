"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  updateAdminSettingsAction, 
  type AdminSettingsFormData,
} from "@/app/actions/settings";
import {
  importClientsFromSheet,
  type ImportResult,
} from "@/app/actions/legacy-import";
import {
  clearOrdersAction,
  clearNonAdminClientsAction,
  clearAllTestDataAction,
  updateTelegramWebhookAction,
  type CleanupResult,
} from "@/app/actions/admin-cleanup";
import toast from "react-hot-toast";
import Link from "next/link";
import { 
  CreditCard, 
  Phone, 
  Save, 
  CheckCircle2, 
  Globe, 
  Clock, 
  Unlock, 
  AlertOctagon, 
  Sparkles,
  Users,
  Download,
  Loader2,
  Trash2,
  AlertTriangle,
  Radio,
  Check,
} from "lucide-react";
import { FaInstagram, FaTiktok, FaTelegram } from "react-icons/fa";
import AdminHelpBanner from "@/components/admin/AdminHelpBanner";

interface Props {
  initialSettings: AdminSettingsFormData;
}

export default function GeneralSettingsClient({ initialSettings }: Props) {
  const router = useRouter();
  const [formData, setFormData] = useState<AdminSettingsFormData>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [importingClients, setImportingClients] = useState(false);
  const [clientsResult, setClientsResult] = useState<ImportResult | null>(null);
  const [cleaningOrders, setCleaningOrders] = useState(false);
  const [cleaningClients, setCleaningClients] = useState(false);
  const [cleaningAll, setCleaningAll] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [updatingWebhook, setUpdatingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await updateAdminSettingsAction(formData);
      if (res.ok) {
        toast.success("Налаштування успішно збережено!");
        setLastSaved(new Date());
        router.refresh();
      } else {
        toast.error(res.error || "Помилка при збереженні");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Помилка при збереженні";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header and Subnav */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              ⚙️ Налаштування сайту
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">
              Керування прийомом замовлень, платіжними реквізитами (IBAN/картка), контактами та соцмережами
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/settings/sheets"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              📊 Таблиці Sheets
            </Link>
          </div>
        </div>
      </div>

      <AdminHelpBanner
        id="general-settings"
        title="Загальні налаштування та режим прийому замовлень"
        description="Керування прийомом замовлень на сайті, платіжними реквізитами (IBAN), контактним телефоном та офіційними посиланнями на соцмережі."
        items={[
          {
            icon: "📦",
            title: "Режим прийому замовлень",
            text: "Дозволяє вручну відкрити замовлення на наступний тиждень завчасно (не чекаючи суботи 12:00) або примусово зупинити прийом замовлень із власним повідомленням для клієнтів.",
          },
          {
            icon: "💳",
            title: "Реквізити IBAN",
            text: "Вкажіть номер банківського рахунку у форматі IBAN, найменування ФОП або картку, які показуються клієнтам при оплаті переказом.",
          },
          {
            icon: "📞",
            title: "Контактний номер",
            text: "Телефон підтримки та прийому замовлень. Відображається у шапці, підвалі сайту та клікабельний для дзвінків.",
          },
          {
            icon: "✈️",
            title: "Telegram компанії",
            text: "Посилання на офіційний канал, чат підтримки або Telegram-бота FoodBalance.",
          },
          {
            icon: "📸",
            title: "Instagram",
            text: "Пряме посилання на профіль бренду в Instagram для іконки у підвалі та контактних блоках.",
          },
          {
            icon: "🎵",
            title: "TikTok",
            text: "Посилання на сторінку сервісу в TikTok для залучення нової аудиторії.",
          },
          {
            icon: "📊",
            title: "Таблиці Google Sheets",
            text: "Кнопка 'Таблиці Sheets' у верхньому правому кутку веде до налаштування щомісячних таблиць замовлень та кухні.",
          },
        ]}
        tips={[
          "Якщо вам потрібно відкрити замовлення на наступний тиждень раніше (наприклад, у четвер чи п'ятницю), виберіть 'Примусово ВІДКРИТИ (Відкрити завчасно)'.",
          "Для стоп-замовлення виберіть 'Примусово ЗАКРИТИ' та вкажіть причину чи час відновлення роботи — клієнти побачать це повідомлення на головній сторінці.",
          "Після будь-яких змін обов'язково натисніть кнопку 'Зберегти зміни' внизу форми.",
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Ordering Mode Section */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Режим прийому замовлень</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Керування статусом замовлень: автоматично за таймінгом або ручне відкриття / стоп-замовлення
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
            {/* AUTO */}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, orderingMode: "AUTO" })}
              className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all duration-150 ${
                formData.orderingMode === "AUTO"
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-sm"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-950/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  Автоматично
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                  За розкладом
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Замовлення відкриваються в суботу о 12:00. Дедлайн кожного дня меню закінчується за 2 дні о 14:00.
              </p>
            </button>

            {/* FORCE_OPEN */}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, orderingMode: "FORCE_OPEN" })}
              className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all duration-150 ${
                formData.orderingMode === "FORCE_OPEN"
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-sm"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-950/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <Unlock className="w-3.5 h-3.5 text-blue-500" />
                  Примусово ВІДКРИТИ
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  Відкрити завчасно
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Негайно відкриває замовлення на наступний тиждень. Усі 7 днів стають доступні для вибору клієнтами.
              </p>
            </button>

            {/* FORCE_CLOSED */}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, orderingMode: "FORCE_CLOSED" })}
              className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all duration-150 ${
                formData.orderingMode === "FORCE_CLOSED"
                  ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 shadow-sm"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-950/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
                  Примусово ЗАКРИТИ
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">
                  Стоп-замовлення
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Повністю блокує оформлення нових замовлень. На головній показується плашка стоп-замовлення.
              </p>
            </button>
          </div>

          {/* Context Alert / Inputs depending on selected mode */}
          {formData.orderingMode === "FORCE_OPEN" && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/40 p-3.5 text-xs text-blue-800 dark:text-blue-200 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <b>Режим ручного відкриття активовано:</b> Клієнти зможуть оформлювати раціони на наступний тиждень у будь-який час, не чекаючи суботи 12:00. Не забудьте повернути &quot;Автоматично&quot;, коли тиждень почнеться.
              </div>
            </div>
          )}

          {formData.orderingMode === "FORCE_CLOSED" && (
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Повідомлення для клієнтів при стоп-замовленні (опціонально)
              </label>
              <textarea
                rows={2}
                value={formData.orderingCustomMessage}
                onChange={(e) => setFormData({ ...formData, orderingCustomMessage: e.target.value })}
                placeholder="Наприклад: Прийом замовлень тимчасово призупинено. Відновимо роботу в понеділок о 10:00."
                className="w-full rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/30 p-3.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                💡 Якщо залишити порожнім, буде показано стандартне системне попередження.
              </p>
            </div>
          )}
        </div>

        {/* Payment Requisites Section */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Реквізити для оплати</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Відображаються клієнту при виборі оплати за IBAN / банківським переказом</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Текст реквізитів (IBAN / картка / ФОП)
            </label>
            <textarea
              rows={6}
              value={formData.ibanDetails}
              onChange={(e) => setFormData({ ...formData, ibanDetails: e.target.value })}
              placeholder="ОТРИМУВАЧ: ...&#10;ЄДРПОУ: ...&#10;IBAN: UA...&#10;Призначення платежу: ..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
            />
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              💡 Цей текст бачитимуть клієнти на сторінці оплати замовлення та при покупці абонементів. Рахунок IBAN автоматично підсвічується окремою кнопкою швидкого копіювання.
            </p>
          </div>
        </div>

        {/* Contact Phone Section */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Контактний телефон</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Номер телефону для зв&apos;язку та підтримки клієнтів</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Номер телефону
            </label>
            <input
              type="text"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              placeholder="+38 (067) 123-45-67"
              className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-2 text-xs text-slate-400">
              💡 Відображається в футері сайту. Якщо залишити це поле <b>порожнім</b>, блок телефону автоматично сховається, і відображатимуться лише посилання на соцмережі.
            </p>
          </div>
        </div>

        {/* Social Links Section */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Соціальні мережі та месенджери</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Посилання на офіційні канали та підтримку у футері</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                <FaTelegram className="w-3.5 h-3.5 text-sky-500" /> Telegram
              </label>
              <input
                type="url"
                value={formData.telegramUrl}
                onChange={(e) => setFormData({ ...formData, telegramUrl: e.target.value })}
                placeholder="https://t.me/foodbalancezp"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                <FaInstagram className="w-3.5 h-3.5 text-pink-500" /> Instagram
              </label>
              <input
                type="url"
                value={formData.instagramUrl}
                onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                placeholder="https://instagram.com/food.balance.zp"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                <FaTiktok className="w-3.5 h-3.5 text-slate-800 dark:text-slate-200" /> TikTok
              </label>
              <input
                type="url"
                value={formData.tiktokUrl}
                onChange={(e) => setFormData({ ...formData, tiktokUrl: e.target.value })}
                placeholder="https://www.tiktok.com/@food.balance.zp"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {lastSaved ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Збережено о {lastSaved.toLocaleTimeString("uk-UA")}
              </span>
            ) : (
              <span>Зміни вступають в силу одразу після збереження</span>
            )}
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Збереження..." : "Зберегти зміни"}
          </button>
        </div>
      </form>

      {/* Legacy Data Sync Section */}
      <div className="mt-8 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-black text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <Download className="w-5 h-5" />
            Синхронізація та інтеграції
          </h2>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            Імпорт бази клієнтів із CRM таблиці (лише ті, що мають Chat ID) та налаштування вебхука бота.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Import Clients */}
          <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-amber-100 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Імпорт клієнтів</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Вкладка Info → таблиця User (з Chat ID)</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Підтягує ПІБ, телефон, адресу та чат ID. Рядки без чат ID пропускаються, щоб не конфліктувати з майбутньою реєстрацією.
              </p>
            </div>
            <div>
              <button
                type="button"
                disabled={importingClients}
                onClick={async () => {
                  setImportingClients(true);
                  setClientsResult(null);
                  try {
                    const res = await importClientsFromSheet();
                    setClientsResult(res);
                    if (res.ok) {
                      toast.success(`Клієнти: +${res.created} нових, ${res.updated} оновлено, ${res.skipped} пропущено`);
                    } else {
                      toast.error(res.errors[0] || "Помилка імпорту");
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Помилка");
                  } finally {
                    setImportingClients(false);
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition active:scale-95 disabled:opacity-50"
              >
                {importingClients ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {importingClients ? "Імпортуємо..." : "Імпортувати клієнтів"}
              </button>
              {clientsResult && (
                <div className={`mt-3 rounded-lg p-3 text-xs font-medium ${
                  clientsResult.ok
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                    : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300"
                }`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span>✅ Створено: <b>{clientsResult.created}</b></span>
                    <span>🔄 Оновлено: <b>{clientsResult.updated}</b></span>
                    <span>⏭️ Пропущено: <b>{clientsResult.skipped}</b></span>
                  </div>
                  {clientsResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-amber-700 dark:text-amber-400">⚠️ {clientsResult.errors.length} попередж.</summary>
                      <ul className="mt-1 space-y-0.5 text-[11px]">
                        {clientsResult.errors.slice(0, 20).map((e, idx) => <li key={idx}>{e}</li>)}
                        {clientsResult.errors.length > 20 && <li>…та ще {clientsResult.errors.length - 20}</li>}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Telegram Webhook */}
          <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-sky-100 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950">
                  <Radio className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Telegram Webhook</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Оновлення адреси вебхука для бота</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Реєструє адресу бота в Telegram на поточний домен (<code className="font-mono bg-sky-50 dark:bg-sky-950/50 px-1 py-0.5 rounded text-sky-700 dark:text-sky-300">/api/telegram-webhook</code>).
              </p>
            </div>
            <div>
              <button
                type="button"
                disabled={updatingWebhook}
                onClick={async () => {
                  setUpdatingWebhook(true);
                  setWebhookResult(null);
                  try {
                    const res = await updateTelegramWebhookAction();
                    setWebhookResult(res);
                    if (res.ok) {
                      toast.success(res.message);
                    } else {
                      toast.error(res.message);
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Помилка");
                  } finally {
                    setUpdatingWebhook(false);
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700 transition active:scale-95 disabled:opacity-50"
              >
                {updatingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                {updatingWebhook ? "Оновлюємо..." : "Оновити Webhook Telegram"}
              </button>
              {webhookResult && (
                <div className={`mt-3 rounded-lg p-3 text-xs font-medium ${
                  webhookResult.ok
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                    : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300"
                }`}>
                  {webhookResult.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone: Database Cleanup */}
      <div className="mt-8 rounded-2xl border border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50/60 to-rose-50/40 dark:from-red-950/30 dark:to-rose-950/20 p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-black text-red-900 dark:text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            Очищення тестових даних (Danger Zone)
          </h2>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">
            Очищення бази від спамних замовлень та тестових користувачів перед релізом. Адміністратори із <code className="font-mono bg-red-200/50 dark:bg-red-900/40 px-1 rounded">TELEGRAM_ADMIN_CHAT_ID</code> надійно захищені від видалення.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Clear Orders */}
          <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-red-100 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Тільки замовлення</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Видаляє всі замовлення, дні доставки, покупки підписок та скидає лічильники днів. Клієнти залишаються в базі.
              </p>
            </div>
            <button
              type="button"
              disabled={cleaningOrders || cleaningAll}
              onClick={async () => {
                if (!window.confirm("Ви впевнені, що хочете видалити ВСІ замовлення та підписки з бази даних? Цю дію неможливо скасувати.")) {
                  return;
                }
                setCleaningOrders(true);
                setCleanupResult(null);
                try {
                  const res = await clearOrdersAction();
                  setCleanupResult(res);
                  if (res.ok) {
                    toast.success(res.message || "Замовлення видалено!");
                    router.refresh();
                  } else {
                    toast.error(res.error || "Помилка");
                  }
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Помилка");
                } finally {
                  setCleaningOrders(false);
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition active:scale-95 disabled:opacity-50"
            >
              {cleaningOrders ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {cleaningOrders ? "Очищення..." : "Очистити замовлення"}
            </button>
          </div>

          {/* Clear Clients (except admins) */}
          <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-red-100 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Клієнти (крім адмінів)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Видаляє всіх користувачів, крім адмінів з Chat ID. Баланси та пов&apos;язані дані цих користувачів також видаляються.
              </p>
            </div>
            <button
              type="button"
              disabled={cleaningClients || cleaningAll}
              onClick={async () => {
                if (!window.confirm("УВАГА! Видалити ВСІХ клієнтів (крім адмінів із TELEGRAM_ADMIN_CHAT_ID)? Продовжити?")) {
                  return;
                }
                setCleaningClients(true);
                setCleanupResult(null);
                try {
                  const res = await clearNonAdminClientsAction();
                  setCleanupResult(res);
                  if (res.ok) {
                    toast.success(res.message || "Клієнтів очищено!");
                    router.refresh();
                  } else {
                    toast.error(res.error || "Помилка");
                  }
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Помилка");
                } finally {
                  setCleaningClients(false);
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition active:scale-95 disabled:opacity-50"
            >
              {cleaningClients ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {cleaningClients ? "Очищення..." : "Очистити клієнтів"}
            </button>
          </div>

          {/* Full Wipe */}
          <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border-2 border-red-300 dark:border-red-800 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">Повне очищення</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Повний скид: видаляє всі замовлення та всіх користувачів (крім адмінів). Ідеально для старту з чистого аркуша.
              </p>
            </div>
            <button
              type="button"
              disabled={cleaningAll || cleaningOrders || cleaningClients}
              onClick={async () => {
                if (!window.confirm("⚠️ КРИТИЧНА ДІЯ: Буде виконано ПОВНЕ очищення бази даних (всі замовлення та всі не-адміни). Підтверджуєте?")) {
                  return;
                }
                setCleaningAll(true);
                setCleanupResult(null);
                try {
                  const res = await clearAllTestDataAction();
                  setCleanupResult(res);
                  if (res.ok) {
                    toast.success(res.message || "Базу повністю очищено!");
                    router.refresh();
                  } else {
                    toast.error(res.error || "Помилка");
                  }
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Помилка");
                } finally {
                  setCleaningAll(false);
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-xs font-black text-white hover:bg-red-800 transition active:scale-95 disabled:opacity-50 shadow-sm"
            >
              {cleaningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
              {cleaningAll ? "Очищення всієї БД..." : "Повне очищення БД"}
            </button>
          </div>
        </div>

        {cleanupResult && (
          <div className={`mt-4 rounded-xl p-4 text-xs font-medium ${
            cleanupResult.ok
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
          }`}>
            <p className="font-bold text-sm mb-1">{cleanupResult.ok ? "✅ Успішно виконано" : "❌ Помилка"}</p>
            <p>{cleanupResult.message || cleanupResult.error}</p>
            {cleanupResult.preservedAdmins && cleanupResult.preservedAdmins.length > 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                <p className="font-semibold text-emerald-900 dark:text-emerald-200">Збережені акаунти адміністраторів:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {cleanupResult.preservedAdmins.map((adm, i) => (
                    <li key={i}>{adm}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
