import "server-only"

import { tryGetRedisClient } from "@/lib/radar/redis"

type MemoryLock = { expiresAt: number }

const memoryLocks = new Map<string, MemoryLock>()

function pruneMemoryLocks(now: number): void {
  for (const [k, v] of memoryLocks) {
    if (v.expiresAt < now) memoryLocks.delete(k)
  }
}

export type CronLockResult = {
  acquired: boolean
  backend: "redis" | "memory"
}

/**
 * Distributed cron lock. Redis SET NX EX when available; otherwise in-memory
 * so global-scan still runs on single-instance / missing REDIS_URL.
 */
export async function acquireCronLock(
  key: string,
  ttlSec: number
): Promise<CronLockResult> {
  const redis = tryGetRedisClient()
  if (redis) {
    try {
      const ok = await redis.set(key, "1", "EX", ttlSec, "NX")
      return { acquired: ok === "OK", backend: "redis" }
    } catch (err) {
      console.warn("[radar/cron-lock]", {
        key,
        result: "redis_error_fallback_memory",
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  const now = Date.now()
  pruneMemoryLocks(now)
  const existing = memoryLocks.get(key)
  if (existing && existing.expiresAt > now) {
    return { acquired: false, backend: "memory" }
  }
  memoryLocks.set(key, { expiresAt: now + ttlSec * 1000 })
  return { acquired: true, backend: "memory" }
}

export async function releaseCronLock(key: string): Promise<void> {
  const redis = tryGetRedisClient()
  if (redis) {
    try {
      await redis.del(key)
    } catch (err) {
      console.warn("[radar/cron-lock]", {
        key,
        result: "release_redis_error",
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }
  memoryLocks.delete(key)
}
