import { CSRF_COOKIE_NAME } from "@/lib/auth/constants";

export const CSRF_HEADER_NAME = "x-csrf-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Double-submit cookie CSRF check. The CSRF cookie is set (non-httpOnly) by
 * middleware.ts on every response; browser-based clients must read it and
 * echo it back in the x-csrf-token header on state-changing requests. A
 * cross-site attacker can trigger the request but cannot read the cookie to
 * forge the header, thanks to the same-origin policy.
 */
export function verifyCsrf(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return true;
  const header = request.headers.get(CSRF_HEADER_NAME);
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  const cookieValue = match?.[1];
  return Boolean(header && cookieValue && header === cookieValue);
}
