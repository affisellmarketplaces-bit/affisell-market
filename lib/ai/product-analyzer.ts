import "server-only"

import { classifyAffisellProduct } from "@/lib/ai/classify-product"
import { CATEGORIES_AFFISELL } from "@/lib/ai/categories"
import { groqChatText } from "@/lib/ai/groq-client"
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

  let raw = ""
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
  const rows = await fetchAllCategoriesForBrowse(prisma)
  const { leafPaths } = buildCategoryBrowse(rows)
  const allowedBreadcrumbs =
    leafPaths.length > 0 ? leafPaths.map((lp) => lp.breadcrumb) : [...CATEGORIES_AFFISELL]

  const { suggestions } = await classifyAffisellProduct(
    {
      title: parsed.title || "Produit",
      description: parsed.description,
      imageUrl,
    },
    { allowedBreadcrumbs, leafPaths }
  )

  const top = suggestions[0]
  const categoryLabel = top?.category?.trim() || parsed.category
  const categoryId = top?.leafId ?? null

  console.log("[product-analyzer]", {
    result: "ok",
    categoryId,
    hasTitle: Boolean(parsed.title),
  })

  return {
    title: parsed.title || "Nouveau produit",
    description: parsed.description,
    category: categoryLabel,
    categoryId,
    attributes: parsed.attributes,
    suggestedPrice: parsed.suggestedPrice,
  }
}
