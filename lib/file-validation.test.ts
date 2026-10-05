import assert from "node:assert/strict";
import test from "node:test";
import {
  detectImageMimeType,
  detectReceiptMimeType,
} from "./file-validation.ts";

test("detectImageMimeType identifies valid image formats", () => {
  // JPEG: FF D8 FF E0
  const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  assert.equal(detectImageMimeType(jpegHeader), "image/jpeg");

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  assert.equal(detectImageMimeType(pngHeader), "image/png");

  // GIF87a: 47 49 46 38 37 61
  const gif87Header = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  assert.equal(detectImageMimeType(gif87Header), "image/gif");

  // GIF89a: 47 49 46 38 39 61
  const gif89Header = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  assert.equal(detectImageMimeType(gif89Header), "image/gif");

  // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  const webpHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(detectImageMimeType(webpHeader), "image/webp");

  // AVIF: ....ftypavif
  const avifHeader = new Uint8Array([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
  assert.equal(detectImageMimeType(avifHeader), "image/avif");
});

test("detectImageMimeType rejects SVG, XML, HTML, and executables", () => {
  // SVG with xml declaration: <?xml version="1.0"?>
  const xmlSvg = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal(detectImageMimeType(xmlSvg), null);

  // Raw SVG tag: <svg ...>
  const rawSvg = new TextEncoder().encode('<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>');
  assert.equal(detectImageMimeType(rawSvg), null);

  // HTML: <!DOCTYPE html>
  const html = new TextEncoder().encode('<!DOCTYPE html><html><body><h1>Evil</h1></body></html>');
  assert.equal(detectImageMimeType(html), null);

  // Short buffer (< 12 bytes)
  assert.equal(detectImageMimeType(new Uint8Array([0xff, 0xd8])), null);

  // Random binary noise
  assert.equal(detectImageMimeType(new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c])), null);
});

test("detectReceiptMimeType correctly handles PDF alongside images", () => {
  // PDF: %PDF
  const pdfHeader = new TextEncoder().encode('%PDF-1.4\n%...\n');
  assert.equal(detectReceiptMimeType(pdfHeader), "application/pdf");

  // PNG through detectReceiptMimeType
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  assert.equal(detectReceiptMimeType(pngHeader), "image/png");

  // SVG rejected by detectReceiptMimeType
  const svg = new TextEncoder().encode('<svg></svg>');
  assert.equal(detectReceiptMimeType(svg), null);
});
