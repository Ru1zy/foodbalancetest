export const TELEGRAM_PLACEHOLDER_PHONE_PREFIX = "telegram-user:";
export const LEGACY_TELEGRAM_PLACEHOLDER_PHONE_PREFIX = "tg_";

export function buildTelegramPlaceholderPhone(chatId: string) {
  return `${TELEGRAM_PLACEHOLDER_PHONE_PREFIX}${chatId}`;
}

export function isTelegramPlaceholderPhone(phone?: string | null) {
  return (
    typeof phone === "string" &&
    (phone.startsWith(TELEGRAM_PLACEHOLDER_PHONE_PREFIX) ||
      phone.startsWith(LEGACY_TELEGRAM_PLACEHOLDER_PHONE_PREFIX))
  );
}

export function sanitizeTelegramPhone(phone?: string | null) {
  if (isTelegramPlaceholderPhone(phone)) {
    return "";
  }

  return typeof phone === "string" ? phone : "";
}
