import { NextResponse } from "next/server"

type Bucket = { resetAt: number; count: number }

const buckets = new Map<string, Bucket>()

/** Client key: prefer authenticated user id, else first IP from proxies. */
export function rateLimitClientKey(req: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`
  const forwarded = req.headers.get("x-forwarded-for")
  const first = forwarded?.split(",")[0]?.trim()
  const ip = first || req.headers.get("x-real-ip")?.trim() || "unknown"
  return `ip:${ip}`
}

/**
 * Fixed-window limiter (in-memory). Fine for single-node / dev; in serverless use Redis (e.g. Upstash).
 * @returns 429 NextResponse or null when allowed.
 */
export function consumeRateLimit(
  key: string,
  opts: { limit: number; windowMs: number; prefix?: string }
): { ok: true } | { ok: false; retrySec: number } {
  const mapKey = `${opts.prefix ?? "rl"}:${key}`
  const now = Date.now()
  const b = buckets.get(mapKey)
  if (!b || now >= b.resetAt) {
    buckets.set(mapKey, { resetAt: now + opts.windowMs, count: 1 })
    return { ok: true }
  }
  if (b.count >= opts.limit) {
    const retrySec = Math.max(1, Math.ceil((b.resetAt - now) / 1000))
    return { ok: false, retrySec }
  }
  b.count += 1
  return { ok: true }
}

export function rateLimitResponse(
  key: string,
  opts: { limit: number; windowMs: number; prefix?: string }
): NextResponse | null {
  const result = consumeRateLimit(key, opts)
  if (result.ok) return null
  return NextResponse.json(
    { error: "Too many requests. Please try again in a moment." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retrySec) },
    }
  )
}
