type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** In-process admin rate limit (10 req/min). Use Redis in multi-instance prod. */
export function checkAdminTryOnRateLimit(key: string, maxPerMinute = 10): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  const windowMs = 60_000
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }

  if (bucket.count >= maxPerMinute) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count += 1
  return { ok: true }
}
