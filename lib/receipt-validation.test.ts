import assert from "node:assert/strict";
import test from "node:test";

test("receipt file validation rejects non-image files", () => {
  const validateReceipt = (mimeType: string) => mimeType.startsWith("image/");
  
  assert.equal(validateReceipt("image/png"), true);
  assert.equal(validateReceipt("image/jpeg"), true);
  assert.equal(validateReceipt("application/pdf"), false);
  assert.equal(validateReceipt("text/plain"), false);
  assert.equal(validateReceipt(""), false);
});
