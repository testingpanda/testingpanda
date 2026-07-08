/**
 * Cookie name/TTL constants shared between src/middleware.ts (edge runtime,
 * cannot import next/headers) and src/lib/auth/session.ts (Node runtime).
 */
export const SESSION_COOKIE_NAME = "gtx_session";
export const CSRF_COOKIE_NAME = "gtx_csrf";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours
