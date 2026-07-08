import { getEnv } from "@/lib/env";
import { LocalStorageDriver } from "@/lib/storage/local";
import { S3StorageDriver } from "@/lib/storage/s3";

/**
 * Storage abstraction so the same application code runs against local disk
 * in development and S3-compatible encrypted object storage in production.
 * Callers always pass/receive already-encrypted bytes (see src/lib/crypto) —
 * this layer only knows about opaque blobs keyed by an opaque storage key.
 * Raw file URLs are never exposed to clients; see src/lib/security/downloadToken.ts
 * for how short-lived access is granted instead.
 */
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

let cached: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (cached) return cached;
  const env = getEnv();
  cached = env.STORAGE_DRIVER === "s3" ? new S3StorageDriver() : new LocalStorageDriver();
  return cached;
}

export function buildStorageKey(taxCaseId: string, documentId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  return `tax-cases/${taxCaseId}/documents/${documentId}/${safeName}.enc`;
}

export function buildGeneratedPdfKey(taxCaseId: string, pdfId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  return `tax-cases/${taxCaseId}/generated/${pdfId}/${safeName}.enc`;
}
