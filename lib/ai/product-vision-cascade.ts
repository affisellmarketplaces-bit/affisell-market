import "server-only"

import { openaiChatText } from "@/lib/ai/openai-chat-fallback"
import type { ProductAnalysisResult } from "@/lib/ai/product-analyzer"
import {
  buildCatalogEmbeddingIndex,
  CASCADE_MATCH_THRESHOLD,
  getOrCreateImageEmbedding,
  searchCatalogByEmbedding,
  type CatalogEmbedMatch,
} from "@/lib/ai/product-embeddings"
import {
  isAiVisionCascadeEnabled,
  PRODUCT_VISION_CASCADE_MINI_MODEL,
} from "@/lib/ai/product-vision-v2-config"
import { stripJsonFence } from "@/lib/ai/product-vision-v2-parse"

export type VisualCuesExtraction = {
  brand: string | null
  model: string | null
  visualCues: string[]
  productType: string
}

export type CascadeMatchResult = {
  analysis: Omit<ProductAnalysisResult, "cached">
  match: CatalogEmbedMatch
  latencyMs: number
  skippedGpt: boolean
}

const CUES_PROMPT = `Tu es un classificateur vision rapide e-commerce (2024–2026).
Analyse l'image et réponds UNIQUEMENT en JSON:
{
  "brand": "Apple",
  "model": "iPhone 17 Pro",
  "visualCues": ["USB-C", "Action Button", "Titane", "triple caméra"],
  "productType": "smartphone"
}
Règles: produit principal uniquement; si coque/étui visible → productType="accessory"; modèle exact ou null si incertain.`

export function parseVisualCuesPayload(raw: string): VisualCuesExtraction {
  const empty: VisualCuesExtraction = {
    brand: null,
    model: null,
    visualCues: [],
    productType: "other",
  }
  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>
    const brand = typeof parsed.brand === "string" ? parsed.brand.trim() : null
    const model = typeof parsed.model === "string" ? parsed.model.trim() : null
    const productType =
      typeof parsed.productType === "string" ? parsed.productType.trim().toLowerCase() : "other"
    const visualCues: string[] = []
    if (Array.isArray(parsed.visualCues)) {
      for (const c of parsed.visualCues) {
        if (typeof c === "string" && c.trim()) visualCues.push(c.trim())
      }
    }
    return { brand: brand || null, model: model || null, visualCues, productType }
  } catch {
    return empty
  }
}

export async function extractVisualCuesFromImage(imageUrl: string): Promise<VisualCuesExtraction> {
  const raw = await openaiChatText({
    model: PRODUCT_VISION_CASCADE_MINI_MODEL,
    vision: true,
    temperature: 0,
    max_tokens: 180,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CUES_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Extrais brand, model, visualCues, productType." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  })
  if (!raw) return { brand: null, model: null, visualCues: [], productType: "other" }
  return parseVisualCuesPayload(raw)
}

export function buildAnalysisFromCatalogMatch(
  match: CatalogEmbedMatch,
  cues: VisualCuesExtraction
): Omit<ProductAnalysisResult, "cached"> {
  const p = match.product
  const confidence = Math.min(0.99, 0.88 + match.score * 0.1)

  return {
    title: p.titleFr,
    description: p.descriptionFr,
    category: p.category,
    categoryId: null,
    attributes: {
      marque: p.brand,
      modele: p.model,
      ...(cues.visualCues[0] ? { cue: cues.visualCues[0] } : {}),
    },
    suggestedPrice: p.suggestedPrice,
    confidence,
    visionVersion: "v2.2",
    detectedModel: p.model,
  }
}

/**
 * Cascade tier-1: embed visual cues → cosine match catalog → skip GPT if score ≥ threshold.
 * Returns null when no high-confidence match (caller falls back to GPT-4o v2).
 */
export async function tryVisionCascadeMatch(args: {
  imageUrl: string
  imageFingerprint: string
}): Promise<CascadeMatchResult | null> {
  if (!isAiVisionCascadeEnabled()) return null

  const started = Date.now()
  const cues = await extractVisualCuesFromImage(args.imageUrl)
  const embedding = await getOrCreateImageEmbedding({
    imageFingerprint: args.imageFingerprint,
    visualCues: cues,
  })

  const catalog = await buildCatalogEmbeddingIndex()
  const match = searchCatalogByEmbedding(embedding, catalog, CASCADE_MATCH_THRESHOLD, cues.model)
  if (!match) {
    console.log("[product-vision-cascade]", {
      result: "no_match",
      threshold: CASCADE_MATCH_THRESHOLD,
      latencyMs: Date.now() - started,
      cues: cues.model,
    })
    return null
  }

  const analysis = buildAnalysisFromCatalogMatch(match, cues)
  const latencyMs = Date.now() - started

  console.log("[product-vision-cascade]", {
    result: "cascade_hit",
    model: match.product.model,
    score: match.score,
    skippedGpt: true,
    latencyMs,
  })

  return { analysis, match, latencyMs, skippedGpt: true }
}
