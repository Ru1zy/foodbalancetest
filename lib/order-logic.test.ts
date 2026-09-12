import assert from "node:assert/strict";
import test from "node:test";
import {
  getOrderTotalUah,
  getOrderDiscount,
  getOrderPriceBreakdown,
  isOrderablePackageType,
  isNextWeekOpen,
  isDaySelectable,
  getSelectableMenuDayNumbers,
} from "./order-logic.ts";

test("Sushka totals are derived from the trusted per-day tariff", () => {
  assert.equal(getOrderTotalUah("Sushka XS", 2), 1420);
  assert.equal(getOrderTotalUah("Sushka S", 3), 2310);
  // With custom DB tariffs override
  assert.equal(getOrderTotalUah("Sushka XS", 2, [{ name: "Sushka XS", basePrice: 500 }]), 1000);
});

test("volume discounts apply for 5-6 days (3%), 7-13 days (5%), 14-29 days (10%), 30+ days (15%)", () => {
  // Balance: base price 670
  // 1-4 days: no discount
  assert.equal(getOrderDiscount("Balance", 1), 0);
  assert.equal(getOrderDiscount("Balance", 4), 0);
  assert.equal(getOrderTotalUah("Balance", 4), 4 * 670); // 2680

  // 5-6 days: 3% discount
  assert.equal(getOrderDiscount("Balance", 5), 0.03);
  assert.equal(getOrderDiscount("Balance", 6), 0.03);
  // 5 * 670 = 3350 -> -3% = 3249.5 -> 3250
  assert.equal(getOrderTotalUah("Balance", 5), 3250);
  // 6 * 670 = 4020 -> -3% = 3899.4 -> 3899
  assert.equal(getOrderTotalUah("Balance", 6), 3899);

  // 7-13 days: 5% discount
  assert.equal(getOrderDiscount("Balance", 7), 0.05);
  // 7 * 670 = 4690 -> -5% = 4455.5 -> 4456
  assert.equal(getOrderTotalUah("Balance", 7), 4456);

  // 14-29 days: 10% discount
  assert.equal(getOrderDiscount("Balance", 14), 0.10);
  // 14 * 670 = 9380 -> -10% = 8442
  assert.equal(getOrderTotalUah("Balance", 14), 8442);

  // 30+ days: 15% discount
  assert.equal(getOrderDiscount("Balance", 30), 0.15);
  // 30 * 670 = 20100 -> -15% = 17085
  assert.equal(getOrderTotalUah("Balance", 30), 17085);

  // Sushka: max discount is 10% from 14 days, 5% for 7-13 days, 3% for 5-6 days
  assert.equal(getOrderDiscount("Sushka XS", 5), 0.03);
  assert.equal(getOrderDiscount("Sushka XS", 7), 0.05);
  assert.equal(getOrderDiscount("Sushka XS", 14), 0.10);
  assert.equal(getOrderDiscount("Sushka XS", 30), 0.10);

  // Price breakdown helper
  const breakdown = getOrderPriceBreakdown("Balance", 6);
  assert.equal(breakdown.originalTotal, 4020);
  assert.equal(breakdown.discountPercent, 3);
  assert.equal(breakdown.finalTotal, 3899);
  assert.equal(breakdown.discountAmount, 121);
});

test("Indiv package price is 0 (negotiated individually with manager)", () => {
  assert.equal(getOrderTotalUah("Indiv", 2, undefined, 5), 0);
  assert.equal(getOrderTotalUah("Indiv", 1, undefined, 0), 0);
  assert.equal(getOrderTotalUah("Indiv", 2, [{ name: "Indiv", basePrice: 0 }], 5), 0);
});

test("only customer-facing package variants are purchasable", () => {
  assert.equal(isOrderablePackageType("Sushka XS"), true);
  assert.equal(isOrderablePackageType("Sushka S"), true);
  assert.equal(isOrderablePackageType("Sushka"), false);
  assert.equal(isOrderablePackageType("Template"), false);
});

test("manual ordering modes behave correctly", () => {
  // FORCE_OPEN opens next week and makes all 7 days selectable
  assert.equal(isNextWeekOpen("FORCE_OPEN"), true);
  assert.equal(isDaySelectable(1, "FORCE_OPEN"), true);
  assert.equal(isDaySelectable(7, "FORCE_OPEN"), true);
  assert.deepEqual(getSelectableMenuDayNumbers("FORCE_OPEN"), [1, 2, 3, 4, 5, 6, 7]);

  // FORCE_CLOSED stops orders completely
  assert.equal(isNextWeekOpen("FORCE_CLOSED"), false);
  assert.equal(isDaySelectable(1, "FORCE_CLOSED"), false);
  assert.equal(isDaySelectable(7, "FORCE_CLOSED"), false);
  assert.deepEqual(getSelectableMenuDayNumbers("FORCE_CLOSED"), []);
});
