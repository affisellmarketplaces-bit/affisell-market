import { getRedisConnection, getRedisUrl } from "@/lib/auto-order/redis"

const KEY = "affisell:auto-buy:last-run"
const MIN_INTERVAL_MS = 30_000

let memoryLastRunAt = 0

/** Global throttle: max 1 AliExpress purchase attempt per 30s. */
export async function acquireAutoBuyRateLimit(): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  const url = getRedisUrl()
  if (!url) {
    const now = Date.now()
    const elapsed = now - memoryLastRunAt
    if (elapsed < MIN_INTERVAL_MS) {
      return { ok: false, retryAfterMs: MIN_INTERVAL_MS - elapsed }
    }
    memoryLastRunAt = now
    return { ok: true }
  }

  const redis = getRedisConnection()
  const set = await redis.set(KEY, String(Date.now()), "PX", MIN_INTERVAL_MS, "NX")
  if (set === "OK") return { ok: true }
  const ttl = await redis.pttl(KEY)
  return { ok: false, retryAfterMs: ttl > 0 ? ttl : MIN_INTERVAL_MS }
}
