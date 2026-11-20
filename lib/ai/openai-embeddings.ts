import "server-only"

import OpenAI from "openai"

import { meterModelCall } from "@/lib/ai/usage-log"

/** Embedding model for {@link openaiTextEmbedding} (a REAL embedding model; the catalog match does not use it). */
export const OPENAI_EMBED_MODEL =
  process.env.OPENAI_EMBED_MODEL?.trim() || "text-embedding-3-small"

const EMBED_DIM = 256

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return null
  return new OpenAI({ apiKey: key })
}

/**
 * Hashed LEXICAL vector of a text — a rule, not a model.
 *
 * Each character and each word of the lower-cased text is hashed into one of `dim` buckets; the vector is then
 * normalised. Two texts get a high cosine similarity when they SHARE CHARACTERS AND WORDS — nothing more. It knows nothing
 * about meaning, images or synonyms ("smartphone" and "téléphone portable" are unrelated to it) and it is NOT a CLIP /
 * vision / semantic embedding (that is what it was wrongly commented as). It is deterministic and free, which is its only
 * merit: InstantScan's catalog-match step uses it to compare the TEXT cues a vision model wrote with a hand-written list.
 *
 * Never compare it with vectors from a real embedding model (different space).
 */
export function hashedLexicalVector(text: string, dim = EMBED_DIM): number[] {
  const vec = new Array<number>(dim).fill(0)
  const normalized = text.trim().toLowerCase()
  if (!normalized) return vec

  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i)
    const idx = (code * (i + 1)) % dim
    vec[idx] = (vec[idx] ?? 0) + ((code % 13) - 6) / 13
  }

  for (const token of normalized.split(/\s+/)) {
    let h = 0
    for (let j = 0; j < token.length; j++) h = (h * 31 + token.charCodeAt(j)) >>> 0
    vec[h % dim] = (vec[h % dim] ?? 0) + 0.25
  }

  return normalizeVector(vec)
}

export function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  if (!Number.isFinite(norm) || norm === 0) return vec.map(() => 0)
  return vec.map((v) => v / norm)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  if (len === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    dot += av * bv
    na += av * av
    nb += bv * bv
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  if (!Number.isFinite(denom) || denom === 0) return 0
  return Math.max(-1, Math.min(1, dot / denom))
}

/**
 * Real embedding through the OpenAI embeddings API (measured by lib/ai/usage-log.ts). Currently UNUSED by the app.
 * Returns `null` when no key is configured or the call fails — it used to silently return {@link hashedLexicalVector}
 * instead, a vector from a different space that would have been compared with real embeddings without anyone noticing.
 */
export async function openaiTextEmbedding(text: string): Promise<number[] | null> {
  const client = getOpenAIClient()
  if (!client) return null

  try {
    const res = await meterModelCall({
      provider: "openai",
      modelRequested: OPENAI_EMBED_MODEL,
      call: () =>
        client.embeddings.create({
          model: OPENAI_EMBED_MODEL,
          input: text.slice(0, 8000),
          dimensions: EMBED_DIM,
        }),
      extract: (r) => ({ modelUsed: r.model, usage: r.usage }),
    })
    const raw = res.data[0]?.embedding
    if (!raw?.length) return null
    return normalizeVector(raw)
  } catch (err) {
    console.log("[openai-embeddings]", { result: "failed", error: String(err) })
    return null
  }
}
