import "server-only"

import { createHash } from "node:crypto"

import { AnthropicError } from "@/lib/ai/anthropic-client"
import { hasAnthropicClassifier } from "@/lib/ai/anthropic-messages"
import { groqTaxonomyCall, hasGroqTaxonomyEngine } from "@/lib/ai/groq-taxonomy-model"
import { classifyProductTaxonomyLite } from "@/lib/ai/taxonomy-classifier-lite"
import {
  classifyProductTaxonomy,
  type TaxonomyBrowse,
  type TaxonomyIdentity,
  type TaxonomyPick,
} from "@/lib/ai/taxonomy-classifier"
import type { LeafPath } from "@/lib/category-browse-shared"

/**
 * Circuit breaker: when the provider says "no credit" or rejects the key, stop calling it for a while instead of
 * paying a failed round-trip on every keystroke. Callers fall back to the legacy engine meanwhile.
 */
const BREAKER_MS = 10 * 60_000
let breakerUntil = 0

export function isBillingOrAuthFailure(error: unknown): boolean {
  if (!(error instanceof AnthropicError)) return false
  if (error.status === 401 || error.status === 403) return true
  return /credit balance|billing|insufficient|invalid x-api-key/i.test(error.message)
}

/** Test hook. */
export function resetTaxonomyBreakerForTests(): void {
  breakerUntil = 0
}

type Cached = { identity: TaxonomyIdentity; picks: Array<{ leafId: string; confidence: number; reason: string }> }

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7
const CACHE_PREFIX = "affisell:taxo-classify:v1"
/** Groq answers are good but not Claude-grade: cache them briefly so a recharged Claude takes over quickly. */
const GROQ_CACHE_PREFIX = "affisell:taxo-classify-groq:v1"
const GROQ_CACHE_TTL_SECONDS = 60 * 60 * 6
const HOURLY_LIMIT_PER_SUPPLIER = 120
const GROQ_HOURLY_LIMIT_PER_SUPPLIER = 240

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

function cacheKeyFor(prefix: string, title: string, imageUrl: string | null | undefined): string {
  const norm = title.toLowerCase().replace(/\s+/g, " ").trim()
  return `${prefix}:${createHash("sha1").update(`${norm}|${imageUrl?.trim() ?? ""}`).digest("hex").slice(0, 24)}`
}

export function classificationCacheKey(title: string, imageUrl: string | null | undefined): string {
  return cacheKeyFor(CACHE_PREFIX, title, imageUrl)
}

export type TaxonomyEngine = "anthropic" | "groq"
export type TaxonomyClassification = { identity: TaxonomyIdentity; picks: TaxonomyPick[]; engine: TaxonomyEngine }

type ClassifyArgs = {
  title: string
  description?: string
  imageUrl?: string | null
  supplierId?: string
  browse: TaxonomyBrowse
  leafPaths: LeafPath[]
}

async function readCache(
  redis: RedisLike | null,
  key: string,
  byId: Map<string, LeafPath>
): Promise<{ identity: TaxonomyIdentity; picks: TaxonomyPick[] } | null> {
  if (!redis) return null
  try {
    const hit = (await redis.get(key)) as Cached | string | null
    const parsed = typeof hit === "string" ? (JSON.parse(hit) as Cached) : hit
    if (parsed?.identity && Array.isArray(parsed.picks)) {
      const picks = parsed.picks.flatMap((p) => {
        const lp = byId.get(p.leafId)
        return lp ? [{ ...lp, confidence: p.confidence, reason: p.reason }] : []
      })
      return { identity: parsed.identity, picks }
    }
  } catch {
    /* cache miss */
  }
  return null
}

async function withinHourlyCap(
  redis: RedisLike | null,
  prefix: string,
  supplierId: string | undefined,
  limit: number
): Promise<boolean> {
  if (!redis || !supplierId) return true
  try {
    const limitKey = `${prefix}:rate:${supplierId}:${new Date().toISOString().slice(0, 13)}`
    const used = await redis.incr(limitKey)
    if (used === 1) await redis.expire(limitKey, 3700).catch(() => undefined)
    return used <= limit
  } catch {
    return true
  }
}

async function writeCache(
  redis: RedisLike | null,
  key: string,
  ttl: number,
  result: { identity: TaxonomyIdentity; picks: TaxonomyPick[] }
): Promise<void> {
  if (!redis || result.picks.length === 0) return
  const value: Cached = {
    identity: result.identity,
    picks: result.picks.map((p) => ({ leafId: p.leafId, confidence: p.confidence, reason: p.reason })),
  }
  await redis.set(key, JSON.stringify(value), { ex: ttl }).catch(() => undefined)
}

/**
 * Semantic taxonomy classification — "understand the product, then descend the tree" — with automatic failover:
 *
 *   1. Claude (cached 7 days, per-supplier hourly cap, circuit breaker on billing/auth failures)
 *   2. Groq running the same identify → choose pipeline, in its token-frugal variant (cached 6 h)
 *
 * Returns null only when no engine could answer — callers must then show NO suggestion rather than invent one.
 * Never throws.
 */
export async function classifyWithTaxonomyAi(args: ClassifyArgs): Promise<TaxonomyClassification | null> {
  const redis = await getRedis()
  const byId = new Map(args.leafPaths.map((lp) => [lp.leafId, lp]))
  const claudeKey = cacheKeyFor(CACHE_PREFIX, args.title, args.imageUrl)
  const groqKey = cacheKeyFor(GROQ_CACHE_PREFIX, args.title, args.imageUrl)
  const input = { title: args.title, description: args.description, imageUrl: args.imageUrl }
  const data = { browse: args.browse, leafPaths: args.leafPaths }

  // Claude's cached answer is free and the best we have, whatever the provider's state is right now.
  const claudeCached = await readCache(redis, claudeKey, byId)
  if (claudeCached) return { ...claudeCached, engine: "anthropic" }

  if (hasAnthropicClassifier() && Date.now() >= breakerUntil) {
    try {
      if (await withinHourlyCap(redis, CACHE_PREFIX, args.supplierId, HOURLY_LIMIT_PER_SUPPLIER)) {
        const result = await classifyProductTaxonomy(input, data)
        if (result && result.picks.length > 0) {
          await writeCache(redis, claudeKey, CACHE_TTL_SECONDS, result)
          return { ...result, engine: "anthropic" }
        }
      }
    } catch (error) {
      if (isBillingOrAuthFailure(error)) {
        breakerUntil = Date.now() + BREAKER_MS
        console.error("[taxonomy-classify] Claude unavailable (billing/auth) — Groq semantic engine for 10 min", {
          error: error instanceof Error ? error.message.slice(0, 160) : String(error),
        })
      } else {
        console.error("[taxonomy-classify]", { error: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  if (!hasGroqTaxonomyEngine()) return null

  const groqCached = await readCache(redis, groqKey, byId)
  if (groqCached) return { ...groqCached, engine: "groq" }

  try {
    if (!(await withinHourlyCap(redis, GROQ_CACHE_PREFIX, args.supplierId, GROQ_HOURLY_LIMIT_PER_SUPPLIER))) return null
    // The token-frugal variant: Groq allows 8 000 tokens/min/model, far below the full classifier's prompt size.
    const result = await classifyProductTaxonomyLite(input, data, { callModel: groqTaxonomyCall })
    if (!result || result.picks.length === 0) return null
    await writeCache(redis, groqKey, GROQ_CACHE_TTL_SECONDS, result)
    return { ...result, engine: "groq" }
  } catch (error) {
    console.error("[taxonomy-classify] groq", { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}
