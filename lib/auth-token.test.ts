import assert from "node:assert/strict";
import test from "node:test";
import { createAuthToken, verifyAuthToken } from "./auth-token.ts";

test("auth-token creates and verifies JWT sessions when AUTH_SECRET is present", async () => {
  const originalSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "super-secret-test-token-key-for-unit-tests-12345";

  try {
    const userId = "test-user-uuid-1234";
    const token = await createAuthToken(userId);
    assert.equal(typeof token, "string");
    assert.ok(token.length > 20);

    const verifiedUserId = await verifyAuthToken(token);
    assert.equal(verifiedUserId, userId);
  } finally {
    process.env.AUTH_SECRET = originalSecret;
  }
});

test("auth-token throws an explicit error when AUTH_SECRET is missing and never falls back", async () => {
  const originalSecret = process.env.AUTH_SECRET;
  const originalBotToken = process.env.TELEGRAM_BOT_TOKEN;

  delete process.env.AUTH_SECRET;
  process.env.TELEGRAM_BOT_TOKEN = "7129663108:FAKE_BOT_TOKEN";

  try {
    await assert.rejects(
      async () => {
        await createAuthToken("test-user");
      },
      {
        message: /AUTH_SECRET environment variable is not configured/,
      }
    );
  } finally {
    process.env.AUTH_SECRET = originalSecret;
    process.env.TELEGRAM_BOT_TOKEN = originalBotToken;
  }
});
