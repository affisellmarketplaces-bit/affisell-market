import "server-only"

import { createHash } from "node:crypto"

import { Redis } from "@upstash/redis"

import type { ProductAnalysisResult } from "@/lib/ai/product-analyzer"

const CACHE_TTL_SEC = 7 * 24 * 60 * 60
const MEMORY_MAX = 200

type MemoryEntry = { value: ProductAnalysisResult; expiresAt: number }

const memory = new Map<string, MemoryEntry>()

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return null
  return new Redis({ url, token })
}

export function productAnalysisCacheKey(imageFingerprint: string): string {
  const hash = createHash("sha256").update(imageFingerprint).digest("hex")
  return `product-analysis:${hash}`
}

export function fingerprintImageInput(input: { imageUrl?: string; imageDataUrl?: string }): string {
  if (input.imageDataUrl?.trim()) {
    const base = input.imageDataUrl.slice(0, 2000)
    return `data:${base.length}:${base.slice(-120)}`
  }
  return `url:${input.imageUrl?.trim() ?? ""}`
}

function pruneMemory(): void {
  if (memory.size <= MEMORY_MAX) return
  const now = Date.now()
  for (const [k, v] of memory) {
    if (v.expiresAt < now) memory.delete(k)
  }
  while (memory.size > MEMORY_MAX) {
    const first = memory.keys().next().value
    if (!first) break
    memory.delete(first)
  }
}

export async function getCachedProductAnalysis(
  key: string
): Promise<ProductAnalysisResult | null> {
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get<string>(key)
      if (!raw) return null
      return JSON.parse(raw) as ProductAnalysisResult
    } catch (err) {
      console.log("[product-analysis-cache]", { key, result: "redis_miss", err: String(err) })
    }
  }

  const entry = memory.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    memory.delete(key)
    return null
  }
  return entry.value
}

export async function setCachedProductAnalysis(
  key: string,
  value: ProductAnalysisResult
): Promise<void> {
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), { ex: CACHE_TTL_SEC })
      return
    } catch (err) {
      console.log("[product-analysis-cache]", { key, result: "redis_set_failed", err: String(err) })
    }
  }

  memory.set(key, { value, expiresAt: Date.now() + CACHE_TTL_SEC * 1000 })
  pruneMemory()
}
