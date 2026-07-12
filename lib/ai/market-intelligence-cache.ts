import "server-only"

import { Redis } from "@upstash/redis"

import type { MarketDataSnapshot } from "@/lib/ai/smart-margin-types"

export const MARKET_REDIS_PREFIX = "market:"
export const MARKET_REDIS_TTL_SEC = 6 * 60 * 60

const MEMORY_MAX = 300
type MemoryEntry = { value: MarketDataSnapshot; expiresAt: number }
const memory = new Map<string, MemoryEntry>()

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return null
  return new Redis({ url, token })
}

export function marketRedisKey(productKey: string): string {
  return `${MARKET_REDIS_PREFIX}${productKey}`
}

function pruneMemory(): void {
  if (memory.size <= MEMORY_MAX) return
  const now = Date.now()
  for (const [k, v] of memory) {
    if (v.expiresAt < now) memory.delete(k)
  }
}

export async function getCachedMarketData(productKey: string): Promise<MarketDataSnapshot | null> {
  const key = marketRedisKey(productKey)
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get<string>(key)
      if (raw) return JSON.parse(raw) as MarketDataSnapshot
    } catch (err) {
      console.log("[market-intelligence-cache]", { key, result: "redis_miss", err: String(err) })
    }
  }
  const entry = memory.get(key)
  if (!entry || entry.expiresAt < Date.now()) return null
  return entry.value
}

export async function setCachedMarketData(
  productKey: string,
  value: MarketDataSnapshot
): Promise<void> {
  const key = marketRedisKey(productKey)
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), { ex: MARKET_REDIS_TTL_SEC })
      return
    } catch (err) {
      console.log("[market-intelligence-cache]", { key, result: "redis_set_failed", err: String(err) })
    }
  }
  memory.set(key, { value, expiresAt: Date.now() + MARKET_REDIS_TTL_SEC * 1000 })
  pruneMemory()
}

/** Test-only */
export function resetMarketCacheForTests(): void {
  memory.clear()
}
