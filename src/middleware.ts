import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth/constants";
import { CSRF_HEADER_NAME } from "@/lib/security/csrf";

const PROTECTED_PAGE_PREFIXES = ["/cases", "/admin", "/settings"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function verifySessionEdge(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api");

  if (isApi && !SAFE_METHODS.has(request.method)) {
    const header = request.headers.get(CSRF_HEADER_NAME);
    const cookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    if (!header || !cookie || header !== cookie) {
      return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 });
    }
  }

  if (!isApi && PROTECTED_PAGE_PREFIXES.some((p) => pathname.startsWith(p))) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const payload = token ? await verifySessionEdge(token) : null;
    if (!payload) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (pathname.startsWith("/admin") && payload.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/cases", request.url));
    }
  }

  const response = NextResponse.next();

  if (!request.cookies.get(CSRF_COOKIE_NAME)) {
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    response.cookies.set(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
