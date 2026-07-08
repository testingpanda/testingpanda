import crypto from "crypto";
import { getEnv } from "@/lib/env";

/**
 * AES-256-GCM envelope helpers used for:
 *  - encrypting uploaded files before they touch disk/object storage
 *    (see src/lib/storage), and
 *  - encrypting individual sensitive DB columns (ExtractedField.value,
 *    evidenceExcerpt, UserConfirmation values, etc).
 *
 * Ciphertext layout: base64( iv(12) || authTag(16) || ciphertext ).
 * A single master key (APP_ENCRYPTION_KEY) is used to derive a per-purpose
 * key via HKDF-like scrypt so file encryption and field encryption don't
 * share raw key material. In production, replace APP_ENCRYPTION_KEY with a
 * KMS-backed key (see README "Production hardening").
 */

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveKey(purpose: string): Buffer {
  const env = getEnv();
  const master = Buffer.from(env.APP_ENCRYPTION_KEY, "base64");
  if (master.length < 32) {
    throw new Error("APP_ENCRYPTION_KEY must decode to at least 32 bytes");
  }
  return crypto.scryptSync(master, `geneva-tax-mvp:${purpose}`, 32);
}

export function encryptBuffer(plaintext: Buffer, purpose = "file"): Buffer {
  const key = deriveKey(purpose);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptBuffer(payload: Buffer, purpose = "file"): Buffer {
  const key = deriveKey(purpose);
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Encrypt a UTF-8 string field for storage. Returns a base64 string, or null for null input. */
export function encryptField(plaintext: string | null | undefined, purpose = "field"): string | null {
  if (plaintext === null || plaintext === undefined) return null;
  return encryptBuffer(Buffer.from(plaintext, "utf8"), purpose).toString("base64");
}

/**
 * Decrypt a field previously produced by encryptField. Returns null for null
 * input, and also returns null (rather than throwing) if the stored value
 * isn't valid ciphertext for this purpose — a single unreadable field must
 * never take down an entire page or API response. This is a defensive
 * backstop, not an expected code path; it should only ever trigger on data
 * corruption or a key mismatch, never in normal operation.
 */
export function decryptField(ciphertextB64: string | null | undefined, purpose = "field"): string | null {
  if (ciphertextB64 === null || ciphertextB64 === undefined || ciphertextB64 === "") return null;
  try {
    return decryptBuffer(Buffer.from(ciphertextB64, "base64"), purpose).toString("utf8");
  } catch {
    return null;
  }
}

export function sha256Hex(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
