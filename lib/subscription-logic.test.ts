import assert from "node:assert/strict";
import test from "node:test";
import { getDiscountForPackage, calculateSubscriptionPrice } from "./subscription-logic.ts";

test("getDiscountForPackage returns correct percentages for standard packages", () => {
  const pkg = "Slim";
  assert.equal(getDiscountForPackage(pkg, 1), 0);
  assert.equal(getDiscountForPackage(pkg, 2), 0.15); // Trial
  assert.equal(getDiscountForPackage(pkg, 3), 0);
  assert.equal(getDiscountForPackage(pkg, 6), 0);
  assert.equal(getDiscountForPackage(pkg, 7), 0.05);
  assert.equal(getDiscountForPackage(pkg, 13), 0.05);
  assert.equal(getDiscountForPackage(pkg, 14), 0.10);
  assert.equal(getDiscountForPackage(pkg, 29), 0.10);
  assert.equal(getDiscountForPackage(pkg, 30), 0.15);
  assert.equal(getDiscountForPackage(pkg, 31), 0.15);
});

test("getDiscountForPackage returns correct percentages for Sushka packages", () => {
  const pkg = "Sushka S";
  assert.equal(getDiscountForPackage(pkg, 1), 0);
  assert.equal(getDiscountForPackage(pkg, 2), 0.10); // Trial for Sushka
  assert.equal(getDiscountForPackage(pkg, 3), 0);
  assert.equal(getDiscountForPackage(pkg, 6), 0);
  assert.equal(getDiscountForPackage(pkg, 7), 0.05);
  assert.equal(getDiscountForPackage(pkg, 13), 0.05);
  assert.equal(getDiscountForPackage(pkg, 14), 0.10);
  assert.equal(getDiscountForPackage(pkg, 29), 0.10);
  assert.equal(getDiscountForPackage(pkg, 30), 0.10); // Sushka max is 10%
  assert.equal(getDiscountForPackage(pkg, 31), 0.10);
});

test("calculateSubscriptionPrice rounds correctly and computes totals", () => {
  // 600 base price for 7 days (5% discount) -> 4200 original -> 3990 discounted -> 570 per day
  const res1 = calculateSubscriptionPrice(600, "Slim", 7);
  assert.equal(res1.totalOriginal, 4200);
  assert.equal(res1.totalDiscounted, 3990);
  assert.equal(res1.pricePerDay, 570);

  // 600 base price for 30 days (15% discount) -> 18000 original -> 15300 discounted -> 510 per day
  const res2 = calculateSubscriptionPrice(600, "Slim", 30);
  assert.equal(res2.totalOriginal, 18000);
  assert.equal(res2.totalDiscounted, 15300);
  assert.equal(res2.pricePerDay, 510);
  
  // Sushka S 600 base price for 30 days (10% discount) -> 18000 original -> 16200 discounted -> 540 per day
  const res3 = calculateSubscriptionPrice(600, "Sushka S", 30);
  assert.equal(res3.totalOriginal, 18000);
  assert.equal(res3.totalDiscounted, 16200);
  assert.equal(res3.pricePerDay, 540);
});
