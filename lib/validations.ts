import { z } from "zod";

export const checkoutSchema = z.object({
  name: z.string().min(2, "Введіть коректне ім'я (мінімум 2 символи)"),
  phone: z.string().regex(/^(?:\+380|380|0)\d{9}$/, "Невірний формат телефону (наприклад: 0501234567 або +380501234567)"),
  address: z.string().min(5, "Введіть повну адресу доставки"),
  comment: z.string(),
  cutlery: z.number().int().min(0).max(10),
  paymentMethod: z.enum(["balance", "card", "cash", "fiat"]),
});

export type CheckoutSchema = z.infer<typeof checkoutSchema>;
