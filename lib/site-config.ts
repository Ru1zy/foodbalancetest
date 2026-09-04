/**
 * Centralized site and brand configuration.
 * All public contact details, socials, and payment info should be sourced from here.
 */
export const SITE_CONFIG = {
  name: "Food Balance",
  tagline: "Здорове харчування з доставкою",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://foodbalancetest-production.up.railway.app",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || null,
  phoneDisplay: process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || null,
  instagram: "https://instagram.com/food.balance.zp",
  telegram: "https://t.me/foodbalancezp",
  tiktok: "https://www.tiktok.com/@food.balance.zp",
  /**
   * Payment details for bank transfer (IBAN).
   * Can be configured via NEXT_PUBLIC_PAYMENT_IBAN_DETAILS in environment variables.
   */
  ibanDetails:
    process.env.NEXT_PUBLIC_PAYMENT_IBAN_DETAILS?.trim() ||
    "Реквізити (IBAN) будуть надіслані вам у Telegram або менеджером при підтвердженні",
};
