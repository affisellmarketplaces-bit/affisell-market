import "server-only"

import { createHash } from "node:crypto"

import { Redis } from "@upstash/redis"

import type { MarginAnalysisResponse } from "@/lib/ai/smart-margin-types"

export const MARGIN_ANALYSIS_TTL_SEC = 60 * 60
const MEMORY_MAX = 200

type MemoryEntry = { value: MarginAnalysisResponse; expiresAt: number }
const memory = new Map<string, MemoryEntry>()

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return null
  return new Redis({ url, token })
}

export function marginAnalysisCacheKey(productKey: string, userId: string, userMargin: number): string {
  const raw = `${productKey}:${userId}:${userMargin}`
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 24)
  return `margin:${hash}`
}

export async function getCachedMarginAnalysis(key: string): Promise<MarginAnalysisResponse | null> {
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get<string>(key)
      if (raw) return JSON.parse(raw) as MarginAnalysisResponse
    } catch (err) {
      console.log("[smart-margin-cache]", { key, result: "redis_miss", err: String(err) })
    }
  }
  const entry = memory.get(key)
  if (!entry || entry.expiresAt < Date.now()) return null
  return entry.value
}

export async function setCachedMarginAnalysis(
  key: string,
  value: MarginAnalysisResponse
): Promise<void> {
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), { ex: MARGIN_ANALYSIS_TTL_SEC })
      return
    } catch (err) {
      console.log("[smart-margin-cache]", { key, result: "redis_set_failed", err: String(err) })
    }
  }
  memory.set(key, { value, expiresAt: Date.now() + MARGIN_ANALYSIS_TTL_SEC * 1000 })
  if (memory.size > MEMORY_MAX) {
    const first = memory.keys().next().value
    if (first) memory.delete(first)
  }
}

export function resetMarginAnalysisCacheForTests(): void {
  memory.clear()
}
