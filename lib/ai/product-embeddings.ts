import "server-only"

import { createHash } from "node:crypto"

import { Redis } from "@upstash/redis"

import {
  cosineSimilarity,
  hashedLexicalVector,
  normalizeVector,
} from "@/lib/ai/openai-embeddings"
import {
  catalogMatchText,
  CURATED_PRODUCT_CATALOG,
  type CuratedProductEntry,
} from "@/lib/ai/curated-product-catalog"
import { redisKey } from "@/lib/redis-namespace"

/**
 * InstantScan "catalog match" step — matching of the TEXT cues a vision model wrote against a hand-written list.
 *
 * Nothing here looks at an image and nothing here is an embedding model: the vectors are hashed lexical vectors
 * (see `hashedLexicalVector`), so the "score" is a measure of shared characters/words, NOT a probability of being right.
 * File and Redis-key names ("embed") are historical and kept so cached data stays readable.
 */

export const PRODUCT_EMBED_REDIS_PREFIX = "product:embed:"
export const PRODUCT_EMBED_TTL_SEC = 7 * 24 * 60 * 60

/** Minimum lexical-similarity score to accept a catalog match. A tuning knob — not a calibrated precision. */
export const CASCADE_MATCH_THRESHOLD = (() => {
  const n = Number(process.env.AI_VISION_CASCADE_THRESHOLD ?? "0.95")
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.95
})()

export type CatalogEmbedMatch = {
  product: CuratedProductEntry
  /** Raw lexical similarity (cosine of hashed vectors, plus the model-name hint bonus). NOT a probability. */
  score: number
}

export type CatalogRow = CuratedProductEntry & { embedding: number[] }

const memoryVectors = new Map<string, number[]>()
let catalogIndex: CatalogRow[] | null = null

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return null
  return new Redis({ url, token })
}

export function productImageEmbedKey(imageFingerprint: string): string {
  const hash = createHash("sha256").update(imageFingerprint).digest("hex")
  return redisKey(`${PRODUCT_EMBED_REDIS_PREFIX}${hash}`)
}

export function visualCuesEmbeddingText(cues: {
  brand?: string | null
  model?: string | null
  visualCues?: string[]
  productType?: string | null
}): string {
  const parts = [
    cues.brand?.trim(),
    cues.model?.trim(),
    ...(cues.visualCues ?? []).map((c) => c.trim()),
    cues.productType?.trim(),
  ].filter(Boolean)
  return parts.join(" ")
}

export async function getCachedCuesVector(key: string): Promise<number[] | null> {
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get<string>(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as number[]
      return Array.isArray(parsed) ? normalizeVector(parsed) : null
    } catch (err) {
      console.log("[product-embeddings]", { key, result: "redis_get_miss", err: String(err) })
    }
  }
  return memoryVectors.get(key) ?? null
}

export async function setCachedCuesVector(key: string, vector: number[]): Promise<void> {
  const vec = normalizeVector(vector)
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(vec), { ex: PRODUCT_EMBED_TTL_SEC })
      return
    } catch (err) {
      console.log("[product-embeddings]", { key, result: "redis_set_failed", err: String(err) })
    }
  }
  memoryVectors.set(key, vec)
}

/** Vectors of the curated catalog, computed once per process. Synthetic placeholder rows are never indexed. */
export async function buildCatalogVectorIndex(): Promise<CatalogRow[]> {
  if (catalogIndex) return catalogIndex

  catalogIndex = CURATED_PRODUCT_CATALOG.filter((product) => !product.synthetic).map((product) => ({
    ...product,
    embedding: hashedLexicalVector(catalogMatchText(product)),
  }))
  return catalogIndex
}

/** Reset in-memory index (tests). */
export function resetCatalogVectorIndexForTests(): void {
  catalogIndex = null
  memoryVectors.clear()
}

function scoreRow(queryVector: number[], row: CatalogRow, hint: string): number {
  let score = cosineSimilarity(queryVector, row.embedding)
  if (hint && row.model.toLowerCase() === hint) {
    // Bonus when the vision model's own claimed model name equals the catalog entry's name (a string equality, not evidence).
    score = Math.min(1, score + (score >= 0.85 ? 0.12 : 0.06))
  }
  return score
}

/**
 * Every catalog row ranked by lexical similarity, best first (ties broken by id so the order is deterministic).
 * Same scoring as {@link searchCatalogByVector}; used to measure top-k behaviour (lib/ai/bench/instantscan-bench.ts).
 */
export function rankCatalogByVector(
  queryVector: number[],
  catalog: CatalogRow[],
  hintModel?: string | null,
  limit = 5
): CatalogEmbedMatch[] {
  const hint = hintModel?.trim().toLowerCase() ?? ""
  return catalog
    .filter((row) => !row.synthetic)
    .map((row) => ({ product: row, score: scoreRow(queryVector, row, hint) }))
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id))
    .slice(0, Math.max(0, limit))
}

export function searchCatalogByVector(
  queryVector: number[],
  catalog: CatalogRow[],
  minScore = CASCADE_MATCH_THRESHOLD,
  hintModel?: string | null
): CatalogEmbedMatch | null {
  let best: CatalogEmbedMatch | null = null
  const hint = hintModel?.trim().toLowerCase() ?? ""

  for (const row of catalog) {
    if (row.synthetic) continue
    const score = scoreRow(queryVector, row, hint)
    if (score < minScore) continue
    if (!best || score > best.score) {
      best = { product: row, score }
    }
  }

  return best
}

export async function cuesToLexicalVector(cues: {
  brand?: string | null
  model?: string | null
  visualCues?: string[]
  productType?: string | null
}): Promise<number[]> {
  const text = visualCuesEmbeddingText(cues)
  if (!text) return hashedLexicalVector("unknown product")
  return hashedLexicalVector(text)
}

/** Vector of the cues text, cached under the image fingerprint (the image itself is never embedded). */
export async function getOrCreateCuesVector(args: {
  imageFingerprint: string
  visualCues: { brand?: string | null; model?: string | null; visualCues?: string[]; productType?: string | null }
}): Promise<number[]> {
  const key = productImageEmbedKey(args.imageFingerprint)
  const cached = await getCachedCuesVector(key)
  if (cached) return cached

  const vector = await cuesToLexicalVector({
    ...args.visualCues,
    productType: args.visualCues.productType,
  })
  await setCachedCuesVector(key, vector)
  return vector
}
