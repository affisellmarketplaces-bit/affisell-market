import { groqChatText } from "@/lib/ai/groq-client"
import type { SupplierScrapedProduct } from "@/lib/supplier-import-url-handler"

const SHOE_KEYWORD_RE =
  /\b(shoe|shoes|sneaker|sneakers|boot|boots|botte|bottes|basket|baskets|chaussure|chaussures|pointure|sandale|mocassin|escarpin|running\s+shoe)\b/i

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

export type MarketplaceImportAiFields = {
  title: string
  description: string
  bullets: string[]
  isShoeProduct: boolean
  brand: string
  categoryHint: string
  tags: string[]
}

export function detectShoeProductFromText(...parts: Array<string | null | undefined>): boolean {
  return parts.some((p) => SHOE_KEYWORD_RE.test((p ?? "").trim()))
}

/** Groq rewrite for marketplace 1-clic import — FR seller copy + SEO bullets. */
export async function enrichMarketplaceImportWithAi(
  product: SupplierScrapedProduct
): Promise<MarketplaceImportAiFields | null> {
  if (!process.env.GROQ_API_KEY?.trim()) return null

  const snapshot = {
    title: product.title,
    description: product.description.slice(0, 2000),
    brand: product.brand,
    category: product.category,
    price: product.price,
    variantCount: product.variants.length,
    rating: product.reviews?.average_rating ?? 0,
    reviewCount: product.reviews?.total ?? 0,
  }

  const raw = await groqChatText({
    temperature: 0.25,
    messages: [
      {
        role: "system",
        content: `You are Affisell's marketplace import agent. Output ONLY valid JSON (no markdown) with keys:
title (string, French commercial seller title max 120 chars, e.g. "Sneakers Urbaines Légères …"),
description (string, French SEO description ~150 words, HTML-free, factual),
bullets (array of exactly 5 French benefit bullet strings, max 120 chars each),
isShoeProduct (boolean, true if product is footwear / sneakers / boots / sandals),
brand (string),
categoryHint (string, French Google Shopping breadcrumb),
tags (array of max 8 lowercase slug strings).
Do not invent certifications. Keep prices out of description.`,
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
  const bullets = Array.isArray(o.bullets)
    ? o.bullets
        .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
        .map((b) => b.trim().slice(0, 160))
        .slice(0, 5)
    : []
  const aiShoe = o.isShoeProduct === true
  const heuristicShoe = detectShoeProductFromText(title, product.title, product.category)
  const brand = typeof o.brand === "string" ? o.brand.trim() : product.brand
  const categoryHint =
    typeof o.categoryHint === "string" ? o.categoryHint.trim() : product.category
  const tags: string[] = Array.isArray(o.tags)
    ? o.tags
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim().toLowerCase().slice(0, 40))
        .slice(0, 8)
    : product.tags

  return {
    title: title || product.title,
    description: description || product.description,
    bullets,
    isShoeProduct: aiShoe || heuristicShoe,
    brand,
    categoryHint,
    tags,
  }
}

export function applyMarketplaceAiToScrapedProduct(
  product: SupplierScrapedProduct,
  enriched: MarketplaceImportAiFields
): SupplierScrapedProduct {
  const tags = enriched.isShoeProduct
    ? Array.from(new Set([...enriched.tags, "shoe-product", "chaussures"]))
    : enriched.tags

  return {
    ...product,
    title: enriched.title || product.title,
    description: enriched.description || product.description,
    ai_title: enriched.title || product.ai_title,
    ai_description: enriched.description || product.ai_description,
    brand: enriched.brand || product.brand,
    category: enriched.categoryHint || product.category,
    tags,
  }
}
