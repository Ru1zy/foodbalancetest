import assert from "node:assert/strict";
import test from "node:test";
import { checkoutSchema } from "./validations.ts";

test("checkoutSchema validation correctly formats and validates phone numbers", () => {
  // Valid phone numbers that should be formatted to 0XXXXXXXXX
  const validPhones = [
    "0501234567",
    "380501234567",
    "+380501234567",
    "050-123-45-67",
    "(050) 123 45 67"
  ];

  for (const phone of validPhones) {
    const data = {
      name: "Ivan",
      phone: phone,
      address: "Vul. Velyka 10",
      comment: "",
      cutlery: 1,
      paymentMethod: "cash"
    };
    const result = checkoutSchema.safeParse(data);
    assert.equal(result.success, true, `Phone ${phone} should be valid`);
    if (result.success) {
      assert.equal(result.data.phone, "0501234567");
    }
  }
});

test("checkoutSchema validation rejects invalid phone numbers", () => {
  const invalidPhones = [
    "123", // Too short
    "05012345678", // Too long
    "" // Empty
  ];

  for (const phone of invalidPhones) {
    const data = {
      name: "Ivan",
      phone: phone,
      address: "Vul. Velyka 10",
      comment: "",
      cutlery: 1,
      paymentMethod: "cash"
    };
    const result = checkoutSchema.safeParse(data);
    assert.equal(result.success, false, `Phone ${phone} should be invalid`);
  }
});

test("checkoutSchema validation enforces min and max for cutlery", () => {
  const data = {
    name: "Ivan",
    phone: "0501234567",
    address: "Vul. Velyka 10",
    comment: "",
    paymentMethod: "cash"
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
