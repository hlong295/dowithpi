import "server-only";

// In-memory rate limit for serverless runtime.
// This is best-effort (resets on cold start) but helps stop rapid spam.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, opts?: { windowMs?: number; max?: number }) {
  const windowMs = Math.max(Number(opts?.windowMs ?? 10_000), 1_000); // default 10s
  const max = Math.max(Number(opts?.max ?? 10), 1);
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, resetAt: now + windowMs };
  }
  if (b.count >= max) {
    return { ok: false, remaining: 0, resetAt: b.resetAt };
  }
  b.count += 1;
  return { ok: true, remaining: Math.max(max - b.count, 0), resetAt: b.resetAt };
}
