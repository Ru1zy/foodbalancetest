import assert from "node:assert/strict";
import test from "node:test";
import {
  isDeliveryDayCancellable,
  shouldRefundBalanceDay,
  calculateNewUsedDays,
} from "./order-logic.ts";

test("cutoff deadline: cancellation allowed at 23:59:00 night before delivery (Kyiv time)", () => {
  // Delivery on September 10, 2026
  const deliveryDate = new Date("2026-09-10T00:00:00.000Z");
  // 23:59:00 on September 9 Kyiv time (EEST is UTC+3 -> 20:59:00Z)
  const allowedNow = new Date("2026-09-09T20:59:00.000Z");

  assert.equal(isDeliveryDayCancellable(deliveryDate, allowedNow), true);
});

test("cutoff deadline: cancellation rejected at 00:00:01 on day of delivery (Kyiv time)", () => {
  const deliveryDate = new Date("2026-09-10T00:00:00.000Z");
  // 00:00:01 on September 10 Kyiv time (EEST is UTC+3 -> 21:00:01Z on Sept 9)
  const rejectedNow = new Date("2026-09-09T21:00:01.000Z");

  assert.equal(isDeliveryDayCancellable(deliveryDate, rejectedNow), false);
});

test("DST handling: summer (UTC+3) vs winter (UTC+2) cutoff boundaries in Kyiv", () => {
  // Summer: July 20, 2026 (EEST = UTC+3)
  // Cutoff is 00:00:00 Kyiv July 20 -> 21:00:00.000Z on July 19
  const summerDelivery = new Date("2026-07-20T00:00:00.000Z");
  const summerJustBefore = new Date("2026-07-19T20:59:59.000Z");
  const summerJustAfter = new Date("2026-07-19T21:00:01.000Z");
  assert.equal(isDeliveryDayCancellable(summerDelivery, summerJustBefore), true);
  assert.equal(isDeliveryDayCancellable(summerDelivery, summerJustAfter), false);

  // Winter: January 20, 2026 (EET = UTC+2)
  // Cutoff is 00:00:00 Kyiv Jan 20 -> 22:00:00.000Z on Jan 19
  const winterDelivery = new Date("2026-01-20T00:00:00.000Z");
  const winterJustBefore = new Date("2026-01-19T21:59:59.000Z");
  const winterJustAfter = new Date("2026-01-19T22:00:01.000Z");
  assert.equal(isDeliveryDayCancellable(winterDelivery, winterJustBefore), true);
  assert.equal(isDeliveryDayCancellable(winterDelivery, winterJustAfter), false);
});

test("balance refund logic: properly restores balance days only up to balanceDaysUsed", () => {
  // Scenario: Order used 2 balance days out of 5 delivery days
  const balanceDaysUsed = 2;

  // 1st cancelled day -> should refund
  assert.equal(shouldRefundBalanceDay(1, balanceDaysUsed), true);
  // 2nd cancelled day -> should refund
  assert.equal(shouldRefundBalanceDay(2, balanceDaysUsed), true);
  // 3rd cancelled day -> paid with fiat/other, should NOT refund balance days
  assert.equal(shouldRefundBalanceDay(3, balanceDaysUsed), false);
  // Order with 0 balance days used -> never refunds balance days
  assert.equal(shouldRefundBalanceDay(1, 0), false);
});

test("usedDays calculation prevents negative balance", () => {
  assert.equal(calculateNewUsedDays(5), 4);
  assert.equal(calculateNewUsedDays(1), 0);
  assert.equal(calculateNewUsedDays(0), 0); // clamp at 0
});
