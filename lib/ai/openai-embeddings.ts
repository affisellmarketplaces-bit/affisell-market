import "server-only"

import OpenAI from "openai"

/** ~$0.02/1M tokens — well under $0.01 per wizard analyze. */
export const OPENAI_EMBED_MODEL =
  process.env.OPENAI_EMBED_MODEL?.trim() || "text-embedding-3-small"

const EMBED_DIM = 256

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return null
  return new OpenAI({ apiKey: key })
}

/** Deterministic unit vector from text — tests + offline fallback (CLIP-proxy). */
export function deterministicTextEmbedding(text: string, dim = EMBED_DIM): number[] {
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

export async function openaiTextEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient()
  if (!client) return deterministicTextEmbedding(text)

  try {
    const res = await client.embeddings.create({
      model: OPENAI_EMBED_MODEL,
      input: text.slice(0, 8000),
      dimensions: EMBED_DIM,
    })
    const raw = res.data[0]?.embedding
    if (!raw?.length) return deterministicTextEmbedding(text)
    return normalizeVector(raw)
  } catch (err) {
    console.log("[openai-embeddings]", { result: "fallback_deterministic", error: String(err) })
    return deterministicTextEmbedding(text)
  }
}
