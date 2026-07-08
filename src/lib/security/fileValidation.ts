import path from "path";
import { getEnv } from "@/lib/env";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

// Explicit denylist of executable / script extensions, checked in addition to
// the MIME allowlist above (defense in depth against spoofed content-types).
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".dll", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".com", ".scr",
  ".js", ".vbs", ".jar", ".app", ".apk", ".bin", ".deb", ".rpm", ".py", ".php",
]);

const MAGIC_BYTES: Record<string, Buffer[]> = {
  "application/pdf": [Buffer.from("%PDF")],
  "image/png": [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  "image/jpeg": [Buffer.from([0xff, 0xd8, 0xff])],
};

export interface FileValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateUploadedFile(params: {
  filename: string;
  declaredMimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}): FileValidationResult {
  const env = getEnv();
  const ext = path.extname(params.filename).toLowerCase();

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, reason: `File type "${ext}" is not allowed` };
  }

  if (!ALLOWED_MIME_TYPES.has(params.declaredMimeType)) {
    return { ok: false, reason: `MIME type "${params.declaredMimeType}" is not allowed` };
  }

  const maxBytes = env.MAX_UPLOAD_SIZE_MB * 1024 * 1024;
  if (params.sizeBytes > maxBytes) {
    return { ok: false, reason: `File exceeds the ${env.MAX_UPLOAD_SIZE_MB}MB size limit` };
  }
  if (params.sizeBytes <= 0) {
    return { ok: false, reason: "File is empty" };
  }

  const signatures = MAGIC_BYTES[params.declaredMimeType] ?? [];
  const matchesSignature = signatures.some((sig) => params.buffer.subarray(0, sig.length).equals(sig));
  if (!matchesSignature) {
    return { ok: false, reason: "File content does not match its declared type" };
  }

  return { ok: true };
}
