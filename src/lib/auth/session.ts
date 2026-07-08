import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { randomToken } from "@/lib/crypto";
import type { Role } from "@prisma/client";
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth/constants";

export { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME, SESSION_TTL_SECONDS };

export interface SessionPayload {
  sub: string; // user id
  email: string;
  role: Role;
}

function getSecretKey() {
  const env = getEnv();
  return new TextEncoder().encode(env.SESSION_SECRET);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub || !payload.email || !payload.role) return null;
    return { sub: payload.sub as string, email: payload.email as string, role: payload.role as Role };
  } catch {
    return null;
  }
}

/** Read + verify the session from the current request's cookies (Server Components, Route Handlers). */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function getCsrfCookieValue(): string | null {
  return cookies().get(CSRF_COOKIE_NAME)?.value ?? null;
}

/**
 * Attach the session + a fresh double-submit CSRF token to a response.
 * Session cookie is httpOnly (never readable by client JS); the CSRF cookie
 * is intentionally readable so the client can echo it back in a header.
 */
export function attachAuthCookies(res: NextResponse, sessionToken: string): NextResponse {
  const env = getEnv();
  const secure = env.NODE_ENV === "production";
  res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  res.cookies.set(CSRF_COOKIE_NAME, randomToken(24), {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}

export function clearAuthCookies(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  res.cookies.set(CSRF_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
