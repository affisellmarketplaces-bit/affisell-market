import "server-only"

import { createHash } from "node:crypto"

import { Redis } from "@upstash/redis"

import {
  cosineSimilarity,
  deterministicTextEmbedding,
  normalizeVector,
} from "@/lib/ai/openai-embeddings"
import {
  catalogEmbeddingText,
  TOP_PRODUCTS_2026,
  type TopProductEntry,
} from "@/lib/ai/top-products-2026"

export const PRODUCT_EMBED_REDIS_PREFIX = "product:embed:"
export const PRODUCT_EMBED_TTL_SEC = 7 * 24 * 60 * 60

export const CASCADE_MATCH_THRESHOLD = (() => {
  const n = Number(process.env.AI_VISION_CASCADE_THRESHOLD ?? "0.95")
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.95
})()

export type CatalogEmbedMatch = {
  product: TopProductEntry
  score: number
}

type CatalogRow = TopProductEntry & { embedding: number[] }

const memoryEmbed = new Map<string, number[]>()
let catalogIndex: CatalogRow[] | null = null

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return null
  return new Redis({ url, token })
}

export function productImageEmbedKey(imageFingerprint: string): string {
  const hash = createHash("sha256").update(imageFingerprint).digest("hex")
  return `${PRODUCT_EMBED_REDIS_PREFIX}${hash}`
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

export async function getCachedImageEmbedding(key: string): Promise<number[] | null> {
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
  return memoryEmbed.get(key) ?? null
}

export async function setCachedImageEmbedding(key: string, embedding: number[]): Promise<void> {
  const vec = normalizeVector(embedding)
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(vec), { ex: PRODUCT_EMBED_TTL_SEC })
      return
    } catch (err) {
      console.log("[product-embeddings]", { key, result: "redis_set_failed", err: String(err) })
    }
  }
  memoryEmbed.set(key, vec)
}

export async function buildCatalogEmbeddingIndex(): Promise<CatalogRow[]> {
  if (catalogIndex) return catalogIndex

  // Pre-computed deterministic vectors — instant cold start (no 100× OpenAI round-trips).
  catalogIndex = TOP_PRODUCTS_2026.map((product) => ({
    ...product,
    embedding: deterministicTextEmbedding(catalogEmbeddingText(product)),
  }))
  return catalogIndex
}

/** Reset in-memory index (tests). */
export function resetCatalogEmbeddingIndexForTests(): void {
  catalogIndex = null
  memoryEmbed.clear()
}

export function searchCatalogByEmbedding(
  queryEmbed: number[],
  catalog: CatalogRow[],
  minScore = CASCADE_MATCH_THRESHOLD,
  hintModel?: string | null
): CatalogEmbedMatch | null {
  let best: CatalogEmbedMatch | null = null
  const hint = hintModel?.trim().toLowerCase() ?? ""

  for (const row of catalog) {
    let score = cosineSimilarity(queryEmbed, row.embedding)
    if (hint && row.model.toLowerCase() === hint) {
      score = Math.min(1, score + (score >= 0.85 ? 0.12 : 0.06))
    }
    if (score < minScore) continue
    if (!best || score > best.score) {
      best = { product: row, score }
    }
  }

  return best
}

export async function embedVisualCuesForMatch(cues: {
  brand?: string | null
  model?: string | null
  visualCues?: string[]
  productType?: string | null
}): Promise<number[]> {
  const text = visualCuesEmbeddingText(cues)
  if (!text) return deterministicTextEmbedding("unknown product")
  return deterministicTextEmbedding(text)
}

export async function getOrCreateImageEmbedding(args: {
  imageFingerprint: string
  visualCues: { brand?: string | null; model?: string | null; visualCues?: string[]; productType?: string | null }
}): Promise<number[]> {
  const key = productImageEmbedKey(args.imageFingerprint)
  const cached = await getCachedImageEmbedding(key)
  if (cached) return cached

  const embedding = await embedVisualCuesForMatch({
    ...args.visualCues,
    productType: args.visualCues.productType,
  })
  await setCachedImageEmbedding(key, embedding)
  return embedding
}
