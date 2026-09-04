/**
 * Centralized site and brand configuration.
 * All public contact details, socials, and payment info should be sourced from here.
 */

export function getPublicAppUrl(request?: Request): string {
  // 1. Check if request headers carry a public forwarded host
  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    if (
      forwardedHost &&
      !forwardedHost.includes("localhost") &&
      !forwardedHost.includes("127.0.0.1") &&
      !forwardedHost.startsWith("0.0.0.0")
    ) {
      return `${forwardedProto}://${forwardedHost}`;
    }
  }

  // 2. Explicit environment overrides
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;
  if (
    envUrl &&
    (process.env.NODE_ENV !== "production" ||
      (!envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")))
  ) {
    return envUrl.replace(/\/+$/, "");
  }

  // 3. Railway public domain
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  // 4. In development, allow localhost if nothing else is provided
  if (process.env.NODE_ENV !== "production") {
    if (request) {
      try {
        const parsed = new URL(request.url);
        return parsed.origin;
      } catch {
        // fallback to standard dev port
      }
    }
    return "http://localhost:3000";
  }

  // 5. Default production domain fallback
  return "https://foodbalancetest-production-5092.up.railway.app";
}

export function createPublicRedirectUrl(path: string, request?: Request): URL {
  const origin = getPublicAppUrl(request);
  return new URL(path, origin);
}

export const SITE_CONFIG = {
  name: "Food Balance",
  tagline: "Здорове харчування з доставкою",
  url: getPublicAppUrl(),
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
