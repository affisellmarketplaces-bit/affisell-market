import "server-only"

import { openaiChatCompletion } from "@/lib/ai/openai-chat-fallback"
import type { ProductAnalysisResult } from "@/lib/ai/product-analyzer"
import {
  buildCatalogVectorIndex,
  CASCADE_MATCH_THRESHOLD,
  getOrCreateCuesVector,
  searchCatalogByVector,
  type CatalogEmbedMatch,
} from "@/lib/ai/product-embeddings"
import {
  isAiVisionCascadeEnabled,
  PRODUCT_VISION_CASCADE_MINI_MODEL,
} from "@/lib/ai/product-vision-v2-config"
import { stripJsonFence } from "@/lib/ai/product-vision-v2-parse"
import { runWithAiUsageContext } from "@/lib/ai/usage-log"

/**
 * InstantScan "catalog match" step (formerly labelled "CLIP" / "embed").
 *
 *   1. a vision LLM (`PRODUCT_VISION_CASCADE_MINI_MODEL`, gpt-4o-mini by default) reads the photo and writes TEXT cues
 *      (brand, model, features);
 *   2. those cues are turned into a hashed lexical vector and compared with a hand-written list of models
 *      (lib/ai/curated-product-catalog.ts) — shared characters/words, not meaning, not pixels. No CLIP, no image embedding;
 *   3. above `CASCADE_MATCH_THRESHOLD` the catalog entry is returned instead of calling the full vision model.
 *
 * There is NO measured accuracy for this step (see lib/__tests__/instantscan-benchmark.test.ts for how it would be
 * measured), so a catalog match is always handed back as "to be reviewed" and carries no invented confidence.
 */

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

export const CUES_PROMPT = `Tu es un classificateur vision e-commerce.
Analyse l'image et réponds UNIQUEMENT en JSON avec exactement ces clés:
{
  "brand": "<marque lisible sur le produit, ou null>",
  "model": "<modèle exact lisible, ou null>",
  "visualCues": ["<signe distinctif visible>", "<autre signe>"],
  "productType": "<smartphone|tablet|laptop|audio|wearable|console|camera|home|accessory|other>"
}
Règles: produit principal uniquement; si coque/étui visible → productType="accessory"; marque et modèle uniquement s'ils sont réellement identifiables sur l'image, sinon null — ne devine pas.`

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

export type CuesExtractionResult = {
  cues: VisualCuesExtraction
  /** Model that really answered (the fallback model when the first attempt failed). `null` when no model ran. */
  modelUsed: string | null
  fallbackUsed: boolean
}

export async function extractVisualCuesWithMeta(imageUrl: string): Promise<CuesExtractionResult> {
  const completion = await runWithAiUsageContext({ feature: "instantscan", tier: "cues_extraction" }, () =>
    openaiChatCompletion({
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
  )
  if (!completion?.text) {
    return {
      cues: { brand: null, model: null, visualCues: [], productType: "other" },
      modelUsed: completion?.modelUsed ?? null,
      fallbackUsed: completion?.fallbackUsed ?? false,
    }
  }
  return {
    cues: parseVisualCuesPayload(completion.text),
    modelUsed: completion.modelUsed,
    fallbackUsed: completion.fallbackUsed,
  }
}

export async function extractVisualCuesFromImage(imageUrl: string): Promise<VisualCuesExtraction> {
  return (await extractVisualCuesWithMeta(imageUrl)).cues
}

/**
 * Builds the analysis returned for a catalog match.
 *
 * Deliberately absent: `confidence`. It used to be `min(0.99, 0.88 + score * 0.1)` — a made-up number that turned a
 * lexical similarity into a "probability" of at least 88 %. No accuracy was ever measured for this step, so none is claimed:
 * the raw similarity is exposed as `provenance.matchScore` (not a probability) and the result is always `needsReview`.
 */
export function buildAnalysisFromCatalogMatch(
  match: CatalogEmbedMatch,
  cues: VisualCuesExtraction,
  meta: { modelUsed?: string | null; fallbackUsed?: boolean } = {}
): Omit<ProductAnalysisResult, "cached"> {
  const p = match.product
  if (p.synthetic) {
    // A placeholder row must never be presented as a result (the index never contains one; this is the last guard).
    throw new Error("synthetic_catalog_entry")
  }

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
    needsReview: true,
    visionVersion: "v2.2",
    detectedModel: p.model,
    instantScanStage: "catalog_match",
    provenance: {
      method: "catalog_lexical_match",
      modelUsed: meta.modelUsed ?? null,
      fallbackUsed: meta.fallbackUsed ?? false,
      confidenceSource: "none",
      matchScore: Math.round(match.score * 1000) / 1000,
      priceSource: p.suggestedPrice == null ? "none" : "editorial_list",
    },
  }
}

/**
 * Catalog-match step: cues from the vision LLM -> lexical match against the curated list -> skip the full vision model
 * when the similarity reaches the threshold. Returns null when nothing matches (the caller runs the full vision step).
 */
export async function tryVisionCascadeMatch(args: {
  imageUrl: string
  imageFingerprint: string
}): Promise<CascadeMatchResult | null> {
  if (!isAiVisionCascadeEnabled()) return null

  const started = Date.now()
  const extraction = await extractVisualCuesWithMeta(args.imageUrl)
  const cues = extraction.cues
  const vector = await getOrCreateCuesVector({
    imageFingerprint: args.imageFingerprint,
    visualCues: cues,
  })

  const catalog = await buildCatalogVectorIndex()
  const match = searchCatalogByVector(vector, catalog, CASCADE_MATCH_THRESHOLD, cues.model)
  if (!match) {
    console.log("[product-vision-cascade]", {
      result: "no_match",
      threshold: CASCADE_MATCH_THRESHOLD,
      latencyMs: Date.now() - started,
      cues: cues.model,
    })
    return null
  }

  const analysis = buildAnalysisFromCatalogMatch(match, cues, {
    modelUsed: extraction.modelUsed,
    fallbackUsed: extraction.fallbackUsed,
  })
  const latencyMs = Date.now() - started

  console.log("[product-vision-cascade]", {
    result: "catalog_match",
    model: match.product.model,
    score: match.score,
    skippedGpt: true,
    latencyMs,
  })

  return { analysis, match, latencyMs, skippedGpt: true }
}
