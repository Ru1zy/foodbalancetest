import assert from "node:assert/strict";
import test from "node:test";
import {
  getOrderTotalUah,
  isOrderablePackageType,
} from "./order-logic.ts";

test("Sushka totals are derived from the trusted per-day tariff", () => {
  assert.equal(getOrderTotalUah("Sushka XS", 2), 1000);
  assert.equal(getOrderTotalUah("Sushka S", 3), 1800);
});

test("only customer-facing package variants are purchasable", () => {
  assert.equal(isOrderablePackageType("Sushka XS"), true);
  assert.equal(isOrderablePackageType("Sushka S"), true);
  assert.equal(isOrderablePackageType("Sushka"), false);
  assert.equal(isOrderablePackageType("Template"), false);
});
