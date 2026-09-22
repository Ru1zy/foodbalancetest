import { Phone, Code2 } from "lucide-react";
import { FaInstagram, FaTiktok, FaTelegram } from "react-icons/fa";
import { getPublicSettings } from "@/app/actions/settings";

export default async function Footer() {
  const settings = await getPublicSettings();
  const currentYear = new Date().getFullYear();
  const yearText = currentYear > 2025 ? `2025–${currentYear}` : "2025";

  return (
    <footer className="bg-slate-900 dark:bg-slate-950 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
        {/* Column 1: Order Conditions */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Умови замовлення</h3>
          <p className="text-sm text-slate-300 dark:text-slate-400 leading-relaxed">
            Ми готуємо зі свіжих продуктів спеціально для вас. Тому замовлення приймаються мінімум за 2 дні до бажаної дати доставки.
          </p>
        </div>

        {/* Column 2: Delivery Schedule */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Графік доставки</h3>
          <p className="text-sm font-medium text-slate-200">Неділя - П&apos;ятниця: 17:00 - 21:30</p>
          <p className="text-xs text-emerald-400 font-medium mt-1 mb-2">
            У п&apos;ятницю доставляємо раціони одразу на вихідні (суботу та неділю).
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Вранці перед доставкою ми повідомимо вам точніший час.
          </p>
        </div>

        {/* Column 3: Contacts */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Контакти</h3>
          <div className="flex flex-col space-y-3 text-sm text-slate-300 dark:text-slate-400">
            {settings.contactPhone && (
              <a 
                href={`tel:${settings.contactPhone.replace(/[^\d+]/g, "")}`} 
                className="flex items-center gap-2 hover:text-emerald-400 transition-colors group"
                title="Зателефонувати нам"
              >
                <Phone className="w-4 h-4 text-emerald-500 shrink-0 group-hover:scale-110 transition-transform" />
                <span>{settings.contactPhone}</span>
              </a>
            )}
            <a 
              href={settings.instagramUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
            >
              <FaInstagram className="w-4 h-4" /> Instagram: @food.balance.zp
            </a>
            <a 
              href={settings.telegramUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
            >
              <FaTelegram className="w-4 h-4" /> Telegram: @foodbalancezp
            </a>
            <a 
              href={settings.tiktokUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
            >
              <FaTiktok className="w-4 h-4" /> TikTok: @food.balance.zp
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="border-t border-slate-800 py-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <p>© {yearText} Food Balance. Всі права захищені.</p>
          <a
            href="https://ru1zy.github.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/70 hover:border-emerald-500/50 transition-all duration-300 shadow-2xs hover:shadow-emerald-500/10 active:scale-95 cursor-pointer"
            title="Портфоліо розробника"
          >
            <span className="text-slate-400 transition-colors group-hover:text-slate-200">
              Created by
            </span>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all duration-500 group-hover:rotate-[360deg] group-hover:scale-110 shadow-xs">
              <Code2 className="w-3 h-3" />
            </span>
            <span className="font-bold tracking-wide bg-gradient-to-r from-slate-200 via-emerald-300 to-emerald-400 bg-clip-text text-transparent group-hover:from-emerald-300 group-hover:to-teal-200 transition-all">
              241
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
