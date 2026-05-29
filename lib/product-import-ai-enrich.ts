import { groqChatText } from "@/lib/ai/groq-client"
import type { SupplierScrapedProduct } from "@/lib/supplier-import-url-handler"

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const candidate = fenced ?? trimmed
  try {
    const parsed = JSON.parse(candidate) as unknown
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export type AiEnrichedImportFields = {
  title: string
  description: string
  brand: string
  categoryHint: string
  specs: Record<string, string>
  tags: string[]
}

/** Groq: normalize partial scrape into Affisell-ready French listing fields. */
export async function enrichScrapedProductWithAi(
  product: SupplierScrapedProduct,
  marketplaceLabel: string
): Promise<AiEnrichedImportFields | null> {
  if (!process.env.GROQ_API_KEY?.trim()) return null

  const snapshot = {
    marketplace: marketplaceLabel,
    title: product.title,
    description: product.description.slice(0, 2000),
    brand: product.brand,
    category: product.category,
    price: product.price,
    currency: product.currency,
    stock: product.stock,
    imageCount: product.images.length,
    variantCount: product.variants.length,
    specs: product.specs,
    source_url: product.source_url,
  }

  const raw = await groqChatText({
    temperature: 0.25,
    messages: [
      {
        role: "system",
        content: `You are Affisell's product import agent. Given scraped ecommerce data, output ONLY valid JSON (no markdown) with keys:
title (string, French commercial title max 120 chars),
description (string, French HTML-free description 2-4 paragraphs, factual only),
brand (string, known brand or "Generic"),
categoryHint (string, Google Shopping style breadcrumb in French e.g. "Électronique > Téléphones"),
specs (object string keys to string values, max 12 entries),
tags (array of max 8 lowercase slug strings).
Do not invent certifications or warranties. Keep prices out of description.`,
      },
      {
        role: "user",
        content: JSON.stringify(snapshot),
      },
    ],
  })

  if (!raw) return null
  const o = parseJsonObject(raw)
  if (!o) return null

  const title = typeof o.title === "string" ? o.title.trim() : product.title
  const description =
    typeof o.description === "string" ? o.description.trim() : product.description
  const brand = typeof o.brand === "string" ? o.brand.trim() : product.brand
  const categoryHint =
    typeof o.categoryHint === "string" ? o.categoryHint.trim() : product.category

  const specs: Record<string, string> = { ...product.specs }
  const specsIn = asRec(o.specs)
  for (const [k, v] of Object.entries(specsIn)) {
    if (typeof v === "string" && v.trim()) specs[k.slice(0, 80)] = v.trim().slice(0, 500)
  }

  const tags: string[] = Array.isArray(o.tags)
    ? o.tags
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim().toLowerCase().slice(0, 40))
        .slice(0, 8)
    : product.tags

  return { title, description, brand, categoryHint, specs, tags }
}

export function applyAiEnrichmentToScrapedProduct(
  product: SupplierScrapedProduct,
  enriched: AiEnrichedImportFields
): SupplierScrapedProduct {
  return {
    ...product,
    title: enriched.title || product.title,
    description: enriched.description || product.description,
    ai_title: enriched.title || product.ai_title,
    ai_description: enriched.description || product.ai_description,
    brand: enriched.brand || product.brand,
    category: enriched.categoryHint || product.category,
    specs: { ...product.specs, ...enriched.specs },
    tags: enriched.tags.length ? enriched.tags : product.tags,
  }
}
