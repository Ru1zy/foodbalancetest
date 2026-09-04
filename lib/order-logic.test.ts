import assert from "node:assert/strict";
import test from "node:test";
import {
  getOrderTotalUah,
  isOrderablePackageType,
  isNextWeekOpen,
  isDaySelectable,
  getSelectableMenuDayNumbers,
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
