import assert from "node:assert/strict";
import test from "node:test";

test("receipt file validation accepts image files and PDF documents", () => {
  const validateReceipt = (mimeType: string, filename?: string) =>
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    (filename ? filename.toLowerCase().endsWith(".pdf") : false);
  
  assert.equal(validateReceipt("image/png"), true);
  assert.equal(validateReceipt("image/jpeg"), true);
  assert.equal(validateReceipt("application/pdf"), true);
  assert.equal(validateReceipt("application/octet-stream", "receipt.pdf"), true);
  assert.equal(validateReceipt("text/plain"), false);
  assert.equal(validateReceipt("application/zip"), false);
  assert.equal(validateReceipt(""), false);
});
