import { z } from "zod";
import { normalizePhone, isValidUkrainianPhone } from "./phone-utils.ts";

/**
 * Validates real human name and surname.
 * Rejects nicknames, gamer tags, numbers, symbols, and random consonant strings.
 */
export function isValidFullName(name: string): boolean {
  const trimmed = (name || "").trim();
  if (trimmed.length < 2 || trimmed.length > 60) return false;

  // 1. Must not contain digits (rejects nicknames like "241.", "w3dsaq", "user123")
  if (/\d/.test(trimmed)) return false;

  // 2. Must not contain forbidden symbols or punctuation
  if (/[_@#$%^&*()+=<>{}[\]\\/|~`!?:;.,]/.test(trimmed)) return false;

  // 3. Must only consist of Ukrainian/Cyrillic or Latin letters, spaces, hyphens and apostrophes
  const validCharsRegex = /^[a-zA-Zа-яА-ЯіїєґІЇЄҐ\s'’ʼ-]+$/;
  if (!validCharsRegex.test(trimmed)) return false;

  // 4. Must not have trailing/leading hyphens or apostrophes, nor consecutive ones
  if (/^[-'’ʼ]|[-'’ʼ]$|[-'’ʼ]{2,}/.test(trimmed)) return false;

  // 5. Must not mix Latin and Cyrillic within the same word, and must contain vowels
  const words = trimmed.split(/\s+/);
  for (const word of words) {
    const hasCyrillic = /[а-яА-ЯіїєґІЇЄҐ]/.test(word);
    const hasLatin = /[a-zA-Z]/.test(word);
    if (hasCyrillic && hasLatin) return false;

    // Check consonant spam (e.g. "qwrtpsdf" or "впрстдл")
    if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(word)) return false;
    if (/[бвгґджзйклмнпрстфхцчшщ]{5,}/i.test(word)) return false;

    // Each word part must have a vowel
    const subWords = word.split("-");
    const vowelRegex = /[аеєиіїоуюяэыёaeiouyАЕЄИІЇОУЮЯЭЫЁAEIOUY]/;
    for (const sub of subWords) {
      if (sub.length > 1 && !vowelRegex.test(sub)) {
        return false;
      }
    }
  }

  // 6. Must not be a repeated single letter like "aaaaa" or "бббб"
  if (/^([a-zA-Zа-яА-ЯіїєґІЇЄҐ])\1{2,}$/i.test(trimmed)) return false;

  return true;
}

export const checkoutSchema = z.object({
  name: z
    .string()
    .min(2, "Введіть коректне ім'я (мінімум 2 символи)")
    .refine(isValidFullName, {
      message: "Вкажіть справжнє ім'я та прізвище (тільки літери, без цифр та нікнеймів)",
    }),
  phone: z
    .string()
    .transform((val) => normalizePhone(val))
    .refine(isValidUkrainianPhone, {
      message: "Неправильний або неіснуючий номер телефону (перевірте код оператора: 050, 066, 067, 068, 073, 075, 077, 093, 095-099 тощо)",
    }),
  address: z.string().min(5, "Введіть повну адресу доставки"),
  comment: z.string(),
  cutlery: z.number().int().min(0).max(10),
  paymentMethod: z.enum(["balance", "card", "cash", "fiat", "plata", "bank_transfer"]),
  receiptUrl: z.string().optional(),
  sendEmailReceipt: z.boolean().optional(),
  receiptEmail: z.string().email("Неправильний формат email").optional().or(z.literal("")),
});

export type CheckoutSchema = z.infer<typeof checkoutSchema>;
