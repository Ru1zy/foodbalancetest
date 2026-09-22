/**
 * Strict phone normalization matching legacy logic.
 * Ensures all formats return the 10-digit Ukrainian format starting with "0".
 *
 * @param phone Raw phone string from input
 * @returns Normalized 10-digit phone string (e.g., "0661234567") or original if invalid
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "";

  // Skip normalization for placeholder phones
  if (
    phone.startsWith('google_') ||
    phone.startsWith('telegram-user:') ||
    phone.startsWith('tg_')
  ) {
    return phone;
  }

  // 1. Strip all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // 2. If the length is 9, prepend "0" (assuming local UA number without lead zero)
  if (digits.length === 9) {
    return `0${digits}`;
  }

  // 3. If the length is 12 and it starts with "380", slice off "380" and prepend "0"
  if (digits.length === 12 && digits.startsWith('380')) {
    return `0${digits.slice(3)}`;
  }

  // 4. If it's already 10 digits and starts with "0", it's already correct
  if (digits.length === 10 && digits.startsWith('0')) {
    return digits;
  }

  // Return digits as fallback if it doesn't match expected patterns
  return digits || phone;
}

/**
 * Matches valid Ukrainian mobile operator and fixed-line area codes:
 * - Mobile: 39, 50, 63, 66, 67, 68, 73, 75, 77, 91, 92, 93, 94, 95, 96, 97, 98, 99
 * - Fixed-line / Area: 31-38, 41-48, 51-57, 61, 62, 64, 65, 69, 89
 */
export const UKRAINIAN_PHONE_REGEX = /^0(3[1-9]|4[1-8]|5[0-7]|6[1-8]|7[357]|89|9[1-9])\d{7}$/;

/**
 * Validates whether a phone number belongs to an active Ukrainian operator or area code,
 * rejecting dummy numbers (e.g. 0500000000) and nonexistent operator codes.
 */
export function isValidUkrainianPhone(phone: string): boolean {
  if (!phone) return false;
  const normalized = normalizePhone(phone);
  if (!UKRAINIAN_PHONE_REGEX.test(normalized)) return false;

  // Reject dummy repeating numbers where the 7 subscriber digits are all identical
  const subscriberPart = normalized.slice(3);
  if (/^(\d)\1{6}$/.test(subscriberPart)) return false;

  return true;
}

