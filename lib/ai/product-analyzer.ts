import "server-only"

import { classifyAffisellProduct } from "@/lib/ai/classify-product"
import { CATEGORIES_AFFISELL } from "@/lib/ai/categories"
import { groqChatText } from "@/lib/ai/groq-client"
import { hasOpenAiFallback, openaiChatText } from "@/lib/ai/openai-chat-fallback"
import {
  isAiVisionCascadeEnabled,
  isAiVisionV2Enabled,
  PRODUCT_VISION_V2_MODEL,
  PRODUCT_VISION_V2_SYSTEM_PROMPT,
  PRODUCT_VISION_V2_TEMPERATURE,
} from "@/lib/ai/product-vision-v2-config"
import {
  auditProductVisionConfidence,
  parseVisionV2Payload,
  shouldRequireManualFallback,
} from "@/lib/ai/product-vision-v2-parse"
import { tryVisionCascadeMatch } from "@/lib/ai/product-vision-cascade"
import { buildCategoryBrowse, fetchAllCategoriesForBrowse } from "@/lib/category-browse"
import { prisma } from "@/lib/prisma"

export type ProductAnalysisResult = {
  title: string
  description: string
  category: string
  categoryId: string | null
  attributes: Record<string, string>
  suggestedPrice: number | null
  cached: boolean
  /** Present when ENABLE_AI_VISION_V2 — model self-reported + audited score. */
  confidence?: number
  visionVersion?: "v1" | "v2" | "v2.2"
  detectedModel?: string | null
  /** InstantScan cascade stage (embed fast-path, gpt4o fallback, groq legacy). */
  instantScanStage?: "embed" | "mini" | "gpt4o" | "groq"
  latencyMs?: number
}

function stripJsonFence(s: string): string {
  const t = s.trim()
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  }
  return t
}

function parseVisionPayload(raw: string): Omit<ProductAnalysisResult, "cached" | "categoryId"> {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(raw))
  } catch {
    return {
      title: "",
      description: "",
      category: "",
      attributes: {},
      suggestedPrice: null,
    }
  }

  const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  const title = typeof o.title === "string" ? o.title.trim() : ""
  const description = typeof o.description === "string" ? o.description.trim() : ""
  const category = typeof o.category === "string" ? o.category.trim() : ""
  const suggestedPrice =
    typeof o.suggestedPrice === "number" && Number.isFinite(o.suggestedPrice)
      ? o.suggestedPrice
      : Number.isFinite(Number(o.suggestedPrice))
        ? Number(o.suggestedPrice)
        : null

  const attributes: Record<string, string> = {}
  if (o.attributes && typeof o.attributes === "object" && !Array.isArray(o.attributes)) {
    for (const [k, v] of Object.entries(o.attributes as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) attributes[k] = v.trim()
    }
  }

  return { title, description, category, attributes, suggestedPrice }
}

export type AnalyzeProductImageInput = {
  imageUrl?: string
  imageDataUrl?: string
}

async function resolveCategoryMatch(args: {
  title: string
  description: string
  category: string
  imageUrl: string
}) {
  const rows = await fetchAllCategoriesForBrowse(prisma)
  const { leafPaths } = buildCategoryBrowse(rows)
  const allowedBreadcrumbs =
    leafPaths.length > 0 ? leafPaths.map((lp) => lp.breadcrumb) : [...CATEGORIES_AFFISELL]

  const { suggestions } = await classifyAffisellProduct(
    {
      title: args.title || "Produit",
      description: args.description,
      imageUrl: args.imageUrl,
    },
    { allowedBreadcrumbs, leafPaths }
  )

  const top = suggestions[0]
  return {
    categoryLabel: top?.category?.trim() || args.category,
    categoryId: top?.leafId ?? null,
  }
}

async function analyzeProductFromImageV2(
  input: AnalyzeProductImageInput
): Promise<Omit<ProductAnalysisResult, "cached">> {
  const imageUrl = input.imageDataUrl?.trim() || input.imageUrl?.trim() || ""

  if (isAiVisionCascadeEnabled()) {
    const fingerprint = input.imageDataUrl?.trim()
      ? `data:${input.imageDataUrl.slice(0, 2000).length}:${input.imageDataUrl.slice(-120)}`
      : `url:${input.imageUrl?.trim() ?? ""}`
    const cascade = await tryVisionCascadeMatch({ imageUrl, imageFingerprint: fingerprint })
    if (cascade) {
      const { categoryLabel, categoryId } = await resolveCategoryMatch({
        title: cascade.analysis.title,
        description: cascade.analysis.description,
        category: cascade.analysis.category,
        imageUrl,
      })
      return {
        ...cascade.analysis,
        category: categoryLabel,
        categoryId,
        visionVersion: "v2.2",
        instantScanStage: "embed",
        latencyMs: cascade.latencyMs,
      }
    }
  }

  return analyzeProductFromImageV2Gpt(imageUrl)
}

async function analyzeProductFromImageV2Gpt(
  imageUrl: string
): Promise<Omit<ProductAnalysisResult, "cached">> {
  if (!hasOpenAiFallback()) {
    console.log("[product-analyzer]", { result: "v2_no_openai_key" })
    throw new Error("ai_unavailable")
  }

  const started = Date.now()
  let raw: string | null = null
  try {
    raw = await openaiChatText({
      model: PRODUCT_VISION_V2_MODEL,
      vision: true,
      temperature: PRODUCT_VISION_V2_TEMPERATURE,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PRODUCT_VISION_V2_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyse cette image produit et remplis le JSON." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    })
    if (!raw) throw new Error("ai_unavailable")
  } catch (err) {
    console.log("[product-analyzer]", { result: "vision_v2_failed", error: String(err) })
    throw new Error("ai_unavailable")
  }

  const parsed = parseVisionV2Payload(raw)
  const confidence = auditProductVisionConfidence(parsed)

  console.log("[product-analyzer]", {
    result: confidence >= 0.8 ? "v2_ok" : "v2_low_confidence",
    confidence,
    productType: parsed.productType,
    detectedModel: parsed.detectedModel,
    latencyMs: Date.now() - started,
  })

  if (shouldRequireManualFallback(confidence)) {
    throw new Error("low_confidence")
  }

  const { categoryLabel, categoryId } = await resolveCategoryMatch({
    title: parsed.title,
    description: parsed.description,
    category: parsed.category,
    imageUrl,
  })

  return {
    title: parsed.title || "Nouveau produit",
    description: parsed.description,
    category: categoryLabel,
    categoryId,
    attributes: parsed.attributes,
    suggestedPrice: parsed.suggestedPrice,
    confidence,
    visionVersion: "v2",
    detectedModel: parsed.detectedModel,
    instantScanStage: "gpt4o",
    latencyMs: Date.now() - started,
  }
}

/**
 * Vision + category leaf match. Caller handles cache read/write.
 */
export async function analyzeProductFromImage(
  input: AnalyzeProductImageInput
): Promise<Omit<ProductAnalysisResult, "cached">> {
  const imageUrl = input.imageDataUrl?.trim() || input.imageUrl?.trim() || ""
  if (!imageUrl) {
    throw new Error("image_required")
  }

  if (isAiVisionV2Enabled()) {
    return analyzeProductFromImageV2(input)
  }

  const started = Date.now()
  const prompt = `Tu es un expert e-commerce français. Analyse cette image produit.
Réponds UNIQUEMENT en JSON valide:
{
  "title": "titre court marketplace FR",
  "description": "2-3 phrases vendeuses",
  "category": "catégorie Affisell la plus probable (breadcrumb style)",
  "attributes": { "couleur": "...", "matiere": "..." },
  "suggestedPrice": 29.99
}
Prix suggestedPrice en EUR TTC catalogue fournisseur plausible.`

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: imageUrl } },
  ]

  let raw: string | null = null
  try {
    raw = await groqChatText({
      messages: [{ role: "user", content }],
      vision: true,
      temperature: 0.2,
      max_tokens: 800,
    })
    if (!raw) throw new Error("ai_unavailable")
  } catch (err) {
    console.log("[product-analyzer]", { result: "vision_failed", error: String(err) })
    throw new Error("ai_unavailable")
  }

  const parsed = parseVisionPayload(raw)
  const { categoryLabel, categoryId } = await resolveCategoryMatch({
    title: parsed.title,
    description: parsed.description,
    category: parsed.category,
    imageUrl,
  })

  console.log("[product-analyzer]", {
    result: "ok",
    categoryId,
    hasTitle: Boolean(parsed.title),
    visionVersion: "v1",
  })

  return {
    title: parsed.title || "Nouveau produit",
    description: parsed.description,
    category: categoryLabel,
    categoryId,
    attributes: parsed.attributes,
    suggestedPrice: parsed.suggestedPrice,
    visionVersion: "v1",
    instantScanStage: "groq",
    latencyMs: Date.now() - started,
  }
}
