/**
 * In-memory fixed-window rate limiter. Sufficient for a single-instance MVP
 * deployment. TODO(production): back this with Redis (e.g. BullMQ's ioredis
 * client) once running more than one app instance, otherwise limits are
 * per-process and can be bypassed by hitting different instances.
 */

interface Bucket {
  count: number;
  windowStartMs: number;
}

const buckets = new Map<string, Bucket>();

// Prevent unbounded memory growth from an ever-growing set of keys (e.g. many IPs).
const MAX_TRACKED_KEYS = 50_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
}

export function checkRateLimit(key: string, max: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartMs >= windowMs) {
    if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
    buckets.set(key, { count: 1, windowStartMs: now });
    return { allowed: true, remaining: max - 1, resetAtMs: now + windowMs };
  }

  if (existing.count >= max) {
    return { allowed: false, remaining: 0, resetAtMs: existing.windowStartMs + windowMs };
  }

  existing.count += 1;
  return { allowed: true, remaining: max - existing.count, resetAtMs: existing.windowStartMs + windowMs };
}

export function clientIdentifierFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
