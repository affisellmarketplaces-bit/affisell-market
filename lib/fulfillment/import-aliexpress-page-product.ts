import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { parseAeCatalogFromHtml } from "@/lib/fulfillment/ae-catalog-from-html"
import { fetchAliExpressProductHtml } from "@/lib/fulfillment/fetch-ae-page-html"
import {
  normalizeImportUrl,
  parseAliExpressHtml,
  type AliExpressParseInput,
} from "@/lib/import-url-scrape"
import type { SupplierScrapedProduct } from "@/lib/supplier-import-url-handler"

function reviewSentiment(rating: number): "positive" | "neutral" | "negative" {
  if (rating >= 4) return "positive"
  if (rating >= 3) return "neutral"
  return "negative"
}

/** Locale + www candidates — AliExpress often blocks one host but not the other. */
export function buildAePageUrlCandidates(aeProductId: string, aeUrl: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (u: string) => {
    const t = u.trim()
    if (!t || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }
  add(normalizeImportUrl(aeUrl, "aliexpress"))
  add(`https://fr.aliexpress.com/item/${aeProductId}.html`)
  add(`https://www.aliexpress.com/item/${aeProductId}.html`)
  return out
}

export function buildSupplierProductFromAeParse(
  parsed: AliExpressParseInput,
  url: string
): SupplierScrapedProduct {
  const aeId = parseAliExpressProductId(url)
  return {
    title: parsed.title,
    description: parsed.description,
    ai_title: parsed.title,
    ai_description: parsed.description,
    price: parsed.price,
    original_price: parsed.original_price || parsed.price,
    currency: "EUR",
    images: parsed.images,
    videos: parsed.videos,
    variants: parsed.variants.map((v) => ({
      name: v.name,
      type: v.type,
      image: v.image,
      price: v.price,
      stock: v.stock,
      sku: v.sku,
      attributes: v.attributes ?? {},
    })),
    colors: parsed.colors,
    sizes: parsed.sizes,
    brand: parsed.brand,
    category: "AliExpress Product",
    sku: parsed.sku || (aeId ? `AE-${aeId}` : ""),
    stock: parsed.stock,
    shipping: {
      from_country: parsed.shipping.from_country,
      delivery_time: parsed.shipping.delivery_time,
      shipping_cost: 0,
      carrier: "Standard",
    },
    reviews: {
      total: parsed.reviews.total,
      average_rating: parsed.reviews.average_rating,
      breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      items: [],
      sentiment: reviewSentiment(parsed.reviews.average_rating),
    },
    specs: {},
    source_platform: "aliexpress",
    source_url: url,
    basePrice: 0,
    costPrice: parsed.price,
    suggested_price: 0,
    suggested_commission: 25,
    profit_per_sale: 0,
    roi: 0,
    tags: [],
    quality_score: 0,
    is_duplicate: false,
    seo_keywords: [],
  }
}

/** Parse AE product HTML into a supplier import draft (no network). */
export function parseSupplierProductFromAeHtml(
  html: string,
  url: string
): SupplierScrapedProduct | null {
  const parsed = parseAliExpressHtml(html, url)
  if (!parsed?.title?.trim()) return null

  const product = buildSupplierProductFromAeParse(parsed, url)
  const catalog = parseAeCatalogFromHtml(html, url)

  if (catalog.title?.trim() && !product.title.trim()) {
    product.title = catalog.title.trim()
    product.ai_title = product.title
  }

  if (catalog.aeSkus.length > 0 && product.variants.length < catalog.aeSkus.length) {
    product.variants = catalog.aeSkus.map((s) => ({
      name: s.aeLabel || s.aeSkuId,
      type: "Variant",
      image: s.imageUrl?.trim() ?? "",
      price: s.aePriceCents > 0 ? s.aePriceCents / 100 : product.price,
      stock: Math.max(0, s.stock),
      sku: s.aeSkuId,
      attributes: {
        ...(s.matchColor ? { Couleur: s.matchColor } : {}),
        ...(s.matchSize ? { Taille: s.matchSize } : {}),
      },
    }))
    const minCents = catalog.aeSkus
      .map((s) => s.aePriceCents)
      .filter((c) => c > 0)
    if (minCents.length > 0 && product.price <= 0) {
      product.price = Math.min(...minCents) / 100
      product.original_price = product.price
      product.costPrice = product.price
    }
  }

  return product
}

export type AePageScrapeResult = {
  product: SupplierScrapedProduct
  method: string
  fetchUrl: string
}

/**
 * Fetch AliExpress product pages (fr + www) and parse without ScrapingBee when possible.
 * Used by Express wizard when Open API is not configured.
 */
export async function scrapeAliExpressViaPageFetch(
  rawUrl: string
): Promise<AePageScrapeResult | null> {
  const aeId = parseAliExpressProductId(rawUrl)
  if (!aeId) return null

  let lastError = ""
  for (const url of buildAePageUrlCandidates(aeId, rawUrl)) {
    const fetched = await fetchAliExpressProductHtml(url)
    if (!fetched.ok) {
      lastError = fetched.error
      console.log("[ae-page-import]", {
        stage: "fetch",
        url,
        result: "fail",
        error: lastError.slice(0, 160),
      })
      continue
    }

    const product = parseSupplierProductFromAeHtml(fetched.html, url)
    if (product?.title?.trim()) {
      console.log("[ae-page-import]", {
        stage: "parse",
        result: "ok",
        url,
        source: fetched.source,
        titleLen: product.title.length,
        imageCount: product.images.length,
        variantCount: product.variants.length,
      })
      return {
        product,
        method: `ae-page-${fetched.source}`,
        fetchUrl: url,
      }
    }

    lastError = "JSON produit introuvable dans la page HTML"
    console.log("[ae-page-import]", {
      stage: "parse",
      result: "empty",
      url,
      source: fetched.source,
      bytes: fetched.html.length,
    })
  }

  if (lastError) {
    console.log("[ae-page-import]", {
      stage: "done",
      result: "fail",
      aeProductId: aeId,
      error: lastError.slice(0, 160),
    })
  }
  return null
}

export function aliExpressExpressImportFailedMessage(): string {
  return (
    "Import AliExpress impossible depuis le serveur pour cette URL. " +
    "Connectez l’API AliExpress (Dashboard → Intégrations) pour un import fiable, " +
    "ou réessayez avec www.aliexpress.com/item/…"
  )
}
