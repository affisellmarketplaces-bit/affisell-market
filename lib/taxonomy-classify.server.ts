import "server-only"

import { createHash } from "node:crypto"

import { hasAnthropicClassifier } from "@/lib/ai/anthropic-messages"
import {
  classifyProductTaxonomy,
  type TaxonomyBrowse,
  type TaxonomyIdentity,
  type TaxonomyPick,
} from "@/lib/ai/taxonomy-classifier"
import type { LeafPath } from "@/lib/category-browse-shared"

type Cached = { identity: TaxonomyIdentity; picks: Array<{ leafId: string; confidence: number; reason: string }> }

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7
const CACHE_PREFIX = "affisell:taxo-classify:v1"
const HOURLY_LIMIT_PER_SUPPLIER = 120

type RedisLike = {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: string, opts?: { ex?: number }) => Promise<unknown>
  incr: (key: string) => Promise<number>
  expire: (key: string, seconds: number) => Promise<unknown>
}

let redisPromise: Promise<RedisLike | null> | null = null
async function getRedis(): Promise<RedisLike | null> {
  redisPromise ??= (async () => {
    if (!process.env.UPSTASH_REDIS_REST_URL?.trim()) return null
    try {
      const { Redis } = await import("@upstash/redis")
      return Redis.fromEnv() as unknown as RedisLike
    } catch {
      return null
    }
  })()
  return redisPromise
}

export function classificationCacheKey(title: string, imageUrl: string | null | undefined): string {
  const norm = title.toLowerCase().replace(/\s+/g, " ").trim()
  return `${CACHE_PREFIX}:${createHash("sha1").update(`${norm}|${imageUrl?.trim() ?? ""}`).digest("hex").slice(0, 24)}`
}

/**
 * Claude taxonomy classification with a 7-day cache (same title + photo = same answer, zero cost) and a per-supplier
 * hourly cap. Returns null when unavailable/failed — callers then use the legacy engine. Never throws.
 */
export async function classifyWithTaxonomyAi(args: {
  title: string
  description?: string
  imageUrl?: string | null
  supplierId?: string
  browse: TaxonomyBrowse
  leafPaths: LeafPath[]
}): Promise<{ identity: TaxonomyIdentity; picks: TaxonomyPick[] } | null> {
  if (!hasAnthropicClassifier()) return null
  const redis = await getRedis()
  const key = classificationCacheKey(args.title, args.imageUrl)
  const byId = new Map(args.leafPaths.map((lp) => [lp.leafId, lp]))

  try {
    if (redis) {
      const hit = (await redis.get(key)) as Cached | string | null
      const parsed = typeof hit === "string" ? (JSON.parse(hit) as Cached) : hit
      if (parsed?.identity && Array.isArray(parsed.picks)) {
        const picks = parsed.picks.flatMap((p) => {
          const lp = byId.get(p.leafId)
          return lp ? [{ ...lp, confidence: p.confidence, reason: p.reason }] : []
        })
        return { identity: parsed.identity, picks }
      }
    }
  } catch {
    /* cache miss */
  }

  try {
    if (redis && args.supplierId) {
      const limitKey = `${CACHE_PREFIX}:rate:${args.supplierId}:${new Date().toISOString().slice(0, 13)}`
      const used = await redis.incr(limitKey)
      if (used === 1) await redis.expire(limitKey, 3700).catch(() => undefined)
      if (used > HOURLY_LIMIT_PER_SUPPLIER) return null
    }

    const result = await classifyProductTaxonomy(
      { title: args.title, description: args.description, imageUrl: args.imageUrl },
      { browse: args.browse, leafPaths: args.leafPaths }
    )
    if (!result) return null

    if (redis && result.picks.length > 0) {
      const value: Cached = {
        identity: result.identity,
        picks: result.picks.map((p) => ({ leafId: p.leafId, confidence: p.confidence, reason: p.reason })),
      }
      await redis.set(key, JSON.stringify(value), { ex: CACHE_TTL_SECONDS }).catch(() => undefined)
    }
    return result
  } catch (error) {
    console.error("[taxonomy-classify]", { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}
