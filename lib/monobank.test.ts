import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAmountWithFee,
  PLATA_FEE_PERCENT,
  getMonobankPublicKey,
  _resetMonobankKeyCacheForTesting,
  _setMonobankKeyCacheForTesting,
  _getMonobankKeyCacheForTesting,
} from "./monobank.ts";

test("calculateAmountWithFee computes gross amount with 1.3% Plata fee", () => {
  assert.equal(PLATA_FEE_PERCENT, 0.013);

  // 100 UAH net: 100 / (1 - 0.013) = 101.317... -> Math.ceil = 102
  assert.equal(calculateAmountWithFee(100), 102);

  // 1000 UAH net: 1000 / 0.987 = 1013.17... -> 1014
  assert.equal(calculateAmountWithFee(1000), 1014);

  // 4200 UAH net: 4200 / 0.987 = 4255.319... -> 4256
  assert.equal(calculateAmountWithFee(4200), 4256);

  // Edge cases: 0 and negative
  assert.equal(calculateAmountWithFee(0), 0);
  assert.equal(calculateAmountWithFee(-100), -101);
});

test("monobank public key TTL cache returns fresh key without calling fetch", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;

  globalThis.fetch = (async () => {
    fetchCallCount++;
    return new Response(JSON.stringify({ key: "fresh-key-from-api" }), { status: 200 });
  }) as any;

  try {
    // Set a cache timestamp from 10 minutes ago (< 1 hour)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    _setMonobankKeyCacheForTesting("cached-key-abc", tenMinutesAgo);

    const key = await getMonobankPublicKey();
    assert.equal(key, "cached-key-abc");
    assert.equal(fetchCallCount, 0, "fetch should not be called when cache is fresh");
  } finally {
    globalThis.fetch = originalFetch;
    _resetMonobankKeyCacheForTesting();
  }
});

test("monobank public key TTL cache re-fetches when key is expired (> 1 hour)", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;

  globalThis.fetch = (async () => {
    fetchCallCount++;
    return new Response(JSON.stringify({ key: "new-rotated-key" }), { status: 200 });
  }) as any;

  try {
    // Set cache timestamp from 2 hours ago (> 1 hour TTL)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    _setMonobankKeyCacheForTesting("old-expired-key", twoHoursAgo);

    const key = await getMonobankPublicKey();
    assert.equal(key, "new-rotated-key");
    assert.equal(fetchCallCount, 1, "fetch must be called when TTL expired");

    const updatedCache = _getMonobankKeyCacheForTesting();
    assert.equal(updatedCache?.key, "new-rotated-key");
    assert.ok(Date.now() - (updatedCache?.fetchedAt || 0) < 5000);
  } finally {
    globalThis.fetch = originalFetch;
    _resetMonobankKeyCacheForTesting();
  }
});

test("monobank public key TTL cache falls back to stale key if refresh fails", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    return new Response("Internal Server Error", { status: 500 });
  }) as any;

  try {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    _setMonobankKeyCacheForTesting("fallback-stale-key", twoHoursAgo);

    const key = await getMonobankPublicKey();
    assert.equal(key, "fallback-stale-key", "should return fallback key on network error");
  } finally {
    globalThis.fetch = originalFetch;
    _resetMonobankKeyCacheForTesting();
  }
});

test("monobank public key throws when no cached key exists and fetch fails", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    return new Response("Unauthorized", { status: 401 });
  }) as any;

  try {
    _resetMonobankKeyCacheForTesting();
    await assert.rejects(
      async () => {
        await getMonobankPublicKey();
      },
      /Failed to fetch Monobank public key/
    );
  } finally {
    globalThis.fetch = originalFetch;
    _resetMonobankKeyCacheForTesting();
  }
});
