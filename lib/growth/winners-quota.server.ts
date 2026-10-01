import "server-only"

import { getRedisUrl } from "@/lib/auto-order/redis"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const WINNERS_QUOTA_DEFAULT = 10
export const WINNERS_QUOTA_LANCEUR = 50

/**
 * Emergency pause for the Growth winners weekly quota (default ON / enforced).
 * Set `GROWTH_WINNERS_QUOTA_PAUSED=1` to disable in prod without a redeploy if it misfires.
 */
export function isWinnersQuotaPaused(): boolean {
  const raw = process.env.GROWTH_WINNERS_QUOTA_PAUSED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function winnersQuotaCapForPlan(growthPlan: string | null | undefined): number {
  return growthPlan === "lanceur" ? WINNERS_QUOTA_LANCEUR : WINNERS_QUOTA_DEFAULT
}

type QuotaResult = { allowed: number; remaining: number; cap: number }

type Bucket = { resetAt: number; count: number }
const buckets = new Map<string, Bucket>()

function consumeInMemory(key: string, amount: number, cap: number): { allowed: number; remaining: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    const allowed = Math.max(0, Math.min(amount, cap))
    buckets.set(key, { resetAt: now + WEEK_MS, count: allowed })
    return { allowed, remaining: Math.max(0, cap - allowed) }
  }
  const remainingBefore = Math.max(0, cap - b.count)
  const allowed = Math.max(0, Math.min(amount, remainingBefore))
  b.count += allowed
  return { allowed, remaining: Math.max(0, cap - b.count) }
}

async function consumeRedis(
  key: string,
  amount: number,
  cap: number
): Promise<{ allowed: number; remaining: number }> {
  const { getRedisConnection } = await import("@/lib/auto-order/redis")
  const redis = getRedisConnection()
  const mapKey = `growth:winners-quota:${key}`
  const windowSec = Math.ceil(WEEK_MS / 1000)

  if (redis.status === "wait") {
    await redis.connect().catch(() => undefined)
  }

  const newCount = await redis.incrby(mapKey, amount)
  if (newCount === amount) {
    await redis.expire(mapKey, windowSec)
  }
  const before = newCount - amount
  const allowed = Math.max(0, Math.min(amount, cap - before))
  const remaining = Math.max(0, cap - newCount)
  return { allowed, remaining }
}

/**
 * Consume up to `requestedCount` from a user's weekly winners quota. Returns how many of the
 * requested rows are actually allowed this call — the caller truncates its response to that
 * count rather than hard-blocking, so a near-limit user still gets a useful partial result
 * (matches the "sans friction" spirit of the Lanceur pricing bullet even on the capped side).
 */
export async function consumeWinnersQuota(
  userId: string,
  requestedCount: number,
  cap: number
): Promise<QuotaResult> {
  if (isWinnersQuotaPaused() || requestedCount <= 0) {
    return { allowed: requestedCount, remaining: Math.max(0, cap), cap }
  }

  const key = `user:${userId}`
  try {
    if (getRedisUrl()) {
      const result = await consumeRedis(key, requestedCount, cap)
      return { ...result, cap }
    }
  } catch (err) {
    console.warn("[growth-winners-quota]", {
      result: "redis_fallback",
      message: err instanceof Error ? err.message : String(err),
    })
  }
  const result = consumeInMemory(key, requestedCount, cap)
  return { ...result, cap }
}
