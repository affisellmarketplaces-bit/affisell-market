import { NextResponse } from "next/server"

import { getRedisUrl } from "@/lib/auto-order/redis"

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
 * Fixed-window limiter (in-memory). Fine for single-node / dev; in serverless use Redis when REDIS_URL is set.
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
  return tooManyRequestsResponse(result.retrySec)
}

function tooManyRequestsResponse(retrySec: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again in a moment." },
    {
      status: 429,
      headers: { "Retry-After": String(retrySec) },
    }
  )
}

async function consumeRateLimitRedis(
  key: string,
  opts: { limit: number; windowMs: number; prefix?: string }
): Promise<{ ok: true } | { ok: false; retrySec: number }> {
  const { getRedisConnection } = await import("@/lib/auto-order/redis")
  const redis = getRedisConnection()
  const mapKey = `rl:${opts.prefix ?? "rl"}:${key}`
  const windowSec = Math.max(1, Math.ceil(opts.windowMs / 1000))

  if (redis.status === "wait") {
    await redis.connect().catch(() => undefined)
  }

  const count = await redis.incr(mapKey)
  if (count === 1) {
    await redis.expire(mapKey, windowSec)
  }

  if (count <= opts.limit) {
    return { ok: true }
  }

  const ttl = await redis.ttl(mapKey)
  const retrySec = ttl > 0 ? ttl : windowSec
  return { ok: false, retrySec }
}

/** Distributed rate limit when REDIS_URL is set; falls back to in-memory. */
export async function rateLimitResponseAsync(
  key: string,
  opts: { limit: number; windowMs: number; prefix?: string }
): Promise<NextResponse | null> {
  if (!getRedisUrl()) {
    return rateLimitResponse(key, opts)
  }

  try {
    const result = await consumeRateLimitRedis(key, opts)
    if (result.ok) return null
    return tooManyRequestsResponse(result.retrySec)
  } catch (err) {
    console.warn("[rate-limit]", {
      result: "redis_fallback",
      message: err instanceof Error ? err.message : String(err),
    })
    return rateLimitResponse(key, opts)
  }
}
