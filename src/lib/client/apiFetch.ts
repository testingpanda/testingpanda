"use client";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** fetch() wrapper that automatically attaches the CSRF header for state-changing requests. */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCookie("gtx_csrf");
    if (csrf) headers.set("x-csrf-token", csrf);
  }
  return fetch(url, { ...init, headers, credentials: "include" });
}

export async function apiJson<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}
