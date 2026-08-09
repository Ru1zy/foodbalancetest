import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function getEncryptionKey(): Buffer {
  const encoded = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encoded) {
    throw new Error("GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY is not configured.");
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      "GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  }

  return key;
}

export function encryptGoogleDriveRefreshToken(refreshToken: string): string {
  if (!refreshToken) {
    throw new Error("Google Drive refresh token is empty.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(refreshToken, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptGoogleDriveRefreshToken(encrypted: string): string {
  const [version, ivPart, tagPart, ciphertextPart, ...extra] = encrypted.split(".");
  if (
    version !== VERSION ||
    !ivPart ||
    !tagPart ||
    !ciphertextPart ||
    extra.length > 0
  ) {
    throw new Error("Stored Google Drive token has an unsupported format.");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");
  if (iv.length !== IV_BYTES) {
    throw new Error("Stored Google Drive token has an invalid IV.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function isGoogleDriveEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}
