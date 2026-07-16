import "server-only"

import { NextResponse } from "next/server"

import { getRedisConnection, getRedisUrl } from "@/lib/auto-order/redis"

const WINDOW_SEC = 60
const MAX_PER_WINDOW = 5

type MemoryBucket = { count: number; expiresAt: number }

/** Dev fallback when REDIS_URL is absent. */
const memoryRates = new Map<string, MemoryBucket>()

function pruneMemoryRates(now: number): void {
  for (const [k, v] of memoryRates) {
    if (v.expiresAt < now) memoryRates.delete(k)
  }
}

export function radarClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwarded) return forwarded
  const realIp = req.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  return "unknown"
}

/**
 * Simple scan rate limit: Redis INCR `radar:scan:rate:{ip}` EX 60, max 5 → 429.
 * In-memory Map when Redis is unavailable (local dev).
 */
export async function assertRadarScanRateLimit(req: Request): Promise<NextResponse | null> {
  const ip = radarClientIp(req)
  const key = `radar:scan:rate:${ip}`

  if (getRedisUrl()) {
    try {
      const redis = getRedisConnection()
      const count = await redis.incr(key)
      if (count === 1) {
        await redis.expire(key, WINDOW_SEC)
      }
      if (count > MAX_PER_WINDOW) {
        console.warn("[radar/scan-rate]", { ip, result: "limited", count })
        return NextResponse.json({ error: "Too many requests" }, { status: 429 })
      }
      return null
    } catch (err) {
      console.warn("[radar/scan-rate]", {
        ip,
        result: "redis_error_fallback_memory",
        message: err instanceof Error ? err.message : "unknown",
      })
      // fall through to memory
    }
  }

  const now = Date.now()
  pruneMemoryRates(now)
  const existing = memoryRates.get(key)
  if (!existing || existing.expiresAt < now) {
    memoryRates.set(key, { count: 1, expiresAt: now + WINDOW_SEC * 1000 })
    return null
  }
  existing.count += 1
  if (existing.count > MAX_PER_WINDOW) {
    console.warn("[radar/scan-rate]", { ip, result: "limited_memory", count: existing.count })
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }
  return null
}
