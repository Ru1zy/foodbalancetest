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
 * Validates if a phone number matches the normalized 10-digit Ukrainian format.
 */
export function isValidNormalizedPhone(phone: string): boolean {
  return /^[0]\d{9}$/.test(phone);
}
