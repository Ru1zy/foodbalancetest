"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  updateAdminSettingsAction, 
  type AdminSettingsFormData 
} from "@/app/actions/settings";
import toast from "react-hot-toast";
import Link from "next/link";
import { CreditCard, Phone, Save, CheckCircle2, Globe } from "lucide-react";
import { FaInstagram, FaTiktok, FaTelegram } from "react-icons/fa";

interface Props {
  initialSettings: AdminSettingsFormData;
}

export default function GeneralSettingsClient({ initialSettings }: Props) {
  const router = useRouter();
  const [formData, setFormData] = useState<AdminSettingsFormData>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

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
              Керування платіжними реквізитами (IBAN/картка), контактами та соцмережами
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

      <form onSubmit={handleSubmit} className="space-y-6">
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
              rows={3}
              value={formData.ibanDetails}
              onChange={(e) => setFormData({ ...formData, ibanDetails: e.target.value })}
              placeholder="UA123456789012345678901234567 (ФОП Прізвище І.Б.) або номер картки"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              💡 Цей текст бачитимуть клієнти на сторінці оплати замовлення та при покупці абонементів. Можна вказати рахунок, призначення платежу або номер картки.
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
    </div>
  );
}
