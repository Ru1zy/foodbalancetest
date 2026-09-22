import assert from "node:assert/strict";
import test from "node:test";
import { checkoutSchema, isValidFullName } from "./validations.ts";
import { isValidUkrainianPhone } from "./phone-utils.ts";

test("checkoutSchema validation correctly formats and validates phone numbers", () => {
  // Valid phone numbers that should be formatted to 0XXXXXXXXX
  const validPhones = [
    "0501234567",
    "380501234567",
    "+380501234567",
    "050-123-45-67",
    "(050) 123 45 67",
    "0671234567",
    "0631234567",
    "0731234567",
    "0771234567", // Kyivstar new
    "0751234567", // Vodafone new
    "0991234567",
  ];

  for (const phone of validPhones) {
    const data = {
      name: "Іван Петренко",
      phone: phone,
      address: "Вул. Велика 10",
      comment: "",
      cutlery: 1,
      paymentMethod: "cash",
    };
    const result = checkoutSchema.safeParse(data);
    assert.equal(result.success, true, `Phone ${phone} should be valid`);
  }
});

test("checkoutSchema validation rejects invalid phone numbers and unknown operator codes", () => {
  const invalidPhones = [
    "123", // Too short
    "05012345678", // Too long
    "", // Empty
    "0000000000", // Nonexistent operator code
    "0111111111", // Nonexistent operator code
    "0222222222", // Nonexistent operator code
    "0701234567", // Nonexistent operator code
    "0901234567", // Nonexistent operator code
    "0500000000", // Dummy repeating number
    "0671111111", // Dummy repeating number
  ];

  for (const phone of invalidPhones) {
    const data = {
      name: "Іван Петренко",
      phone: phone,
      address: "Вул. Велика 10",
      comment: "",
      cutlery: 1,
      paymentMethod: "cash",
    };
    const result = checkoutSchema.safeParse(data);
    assert.equal(result.success, false, `Phone ${phone} should be rejected`);
  }
});

test("checkoutSchema rejects nicknames and invalid names", () => {
  const invalidNames = [
    "241.", // digits and dot from screenshot
    "w3dsaq", // leet speak / nickname with digit from screenshot
    "user_123", // symbols and digits
    "xX_gamer_Xx", // gamer handle
    "12345", // digits only
    "___", // symbols only
    "A", // single letter
    "qwrtypsdf", // consonant spam
    "aaaaaa", // repeated single character
    "Ігор.", // trailing punctuation
    "-Олександр", // leading hyphen
  ];

  for (const name of invalidNames) {
    const data = {
      name: name,
      phone: "0501234567",
      address: "Вул. Велика 10",
      comment: "",
      cutlery: 1,
      paymentMethod: "cash",
    };
    const result = checkoutSchema.safeParse(data);
    assert.equal(result.success, false, `Name "${name}" should be rejected`);
  }
});

test("checkoutSchema accepts valid human names", () => {
  const validNames = [
    "Олександр",
    "Олександр Іванов",
    "Мар'яна",
    "В’ячеслав Петренко",
    "Анна-Марія",
    "John Doe",
    "Jean-Luc",
    "Тарас Шевченко",
  ];

  for (const name of validNames) {
    const data = {
      name: name,
      phone: "0501234567",
      address: "Вул. Велика 10",
      comment: "",
      cutlery: 1,
      paymentMethod: "cash",
    };
    const result = checkoutSchema.safeParse(data);
    assert.equal(result.success, true, `Name "${name}" should be accepted`);
  }
});

test("checkoutSchema validation enforces min and max for cutlery", () => {
  const data = {
    name: "Іван Петренко",
    phone: "0501234567",
    address: "Вул. Велика 10",
    comment: "",
    paymentMethod: "cash",
  };

  // Valid cutlery
  const res1 = checkoutSchema.safeParse({ ...data, cutlery: 0 });
  assert.equal(res1.success, true);
  const res2 = checkoutSchema.safeParse({ ...data, cutlery: 5 });
  assert.equal(res2.success, true);
  const res3 = checkoutSchema.safeParse({ ...data, cutlery: 10 });
  assert.equal(res3.success, true);

  // Invalid cutlery
  const res4 = checkoutSchema.safeParse({ ...data, cutlery: -1 });
  assert.equal(res4.success, false);
  const res5 = checkoutSchema.safeParse({ ...data, cutlery: 11 });
  assert.equal(res5.success, false);
});
