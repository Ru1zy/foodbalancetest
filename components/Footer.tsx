import Link from "next/link";
import { Phone } from "lucide-react";
import { FaInstagram, FaTiktok } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-gray-200 mt-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
        {/* Column 1: Order Conditions */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4">Умови замовлення</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Ми готуємо зі свіжих продуктів спеціально для вас. Тому замовлення приймаються мінімум за 2 дні до бажаної дати доставки.
          </p>
        </div>

        {/* Column 2: Delivery Schedule */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4">Графік доставки</h3>
          <p className="text-sm font-medium text-slate-800">Неділя - П&apos;ятниця: 17:00 - 20:30</p>
          <p className="text-xs text-emerald-600 font-medium mt-1 mb-2">
            У п&apos;ятницю доставляємо раціони одразу на вихідні (суботу та неділю).
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Кур&apos;єр зв&apos;яжеться з вами за 15 хвилин до прибуття.
          </p>
        </div>

        {/* Column 3: Contacts */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4">Контакти</h3>
          <div className="flex flex-col space-y-3 text-sm text-slate-600">
            <a href="tel:+380000000000" className="flex items-center gap-2 hover:text-emerald-600 transition-colors">
              <Phone className="w-4 h-4" /> +38 (000) 000-00-00
            </a>
            <a 
              href="https://instagram.com/food.balance.zp" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 hover:text-emerald-600 transition-colors"
            >
              <FaInstagram className="w-4 h-4" /> Instagram: @food.balance.zp
            </a>
            <a 
              href="https://www.tiktok.com/@food.balance.zp" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 hover:text-emerald-600 transition-colors"
            >
              <FaTiktok className="w-4 h-4" /> TikTok: @food.balance.zp
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="border-t border-gray-200 py-6 mt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <p>© 2026 Food Balance. Всі права захищені.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-emerald-600 transition-colors">
              Політика конфіденційності
            </Link>
            <Link href="/terms" className="hover:text-emerald-600 transition-colors">
              Умови користування
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
