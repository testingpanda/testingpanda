import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/env";

/**
 * App-issued short-lived download tokens. Raw storage URLs (local path or S3
 * key) are never sent to the browser. Instead the client receives a
 * signed, expiring token bound to a specific resource + user; the download
 * route verifies it, fetches the encrypted blob server-side, decrypts it,
 * and streams the plaintext response. This holds for both storage drivers —
 * an S3-native presigned URL would only serve back application-encrypted
 * ciphertext, so decryption must happen in our server regardless.
 */
export interface DownloadTokenPayload {
  resourceType: "document" | "generated_pdf";
  resourceId: string;
  userId: string;
}

function getSecretKey() {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export async function createDownloadToken(payload: DownloadTokenPayload): Promise<string> {
  const env = getEnv();
  return new SignJWT({ ...payload, purpose: "download" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${env.STORAGE_SIGNED_URL_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyDownloadToken(token: string): Promise<DownloadTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== "download") return null;
    return {
      resourceType: payload.resourceType as DownloadTokenPayload["resourceType"],
      resourceId: payload.resourceId as string,
      userId: payload.userId as string,
    };
  } catch {
    return null;
  }
}
