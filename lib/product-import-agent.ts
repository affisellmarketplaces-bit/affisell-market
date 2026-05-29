import { AliExpressApiError, createAliExpressClient } from "@/lib/aliexpress-open-api"
import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import { getAliExpressConfigStatus } from "@/lib/aliexpress-config"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { classifyAffisellProduct } from "@/lib/ai/classify-product"
import {
  buildCategoryBrowse,
  fetchAllCategoriesForBrowse,
  type LeafPath,
} from "@/lib/category-browse"
import { prisma } from "@/lib/prisma"
import { detectMarketplaceFromUrl } from "@/lib/import-marketplace"
import {
  applyAiEnrichmentToScrapedProduct,
  enrichScrapedProductWithAi,
} from "@/lib/product-import-ai-enrich"
import {
  scrapeSupplierProductFromUrl,
  type SupplierScrapedProduct,
  type SupplierImportUrlBody,
} from "@/lib/supplier-import-url-handler"

export type ProductImportAgentStep =
  | "detect"
  | "fetch"
  | "enrich"
  | "categorize"
  | "done"

export type ProductImportAgentCategory = {
  leafId: string | null
  breadcrumb: string
  confidence: number
  reason: string
}

export type ProductImportAgentResult = {
  ok: true
  marketplace: ReturnType<typeof detectMarketplaceFromUrl>
  product: SupplierScrapedProduct
  platform: string
  method: string
  warnings: string[]
  steps: ProductImportAgentStep[]
  aiEnriched: boolean
  category: ProductImportAgentCategory | null
}

export type ProductImportAgentError = {
  ok: false
  error: string
  status: number
  useAliExpressApi?: boolean
  marketplace?: ReturnType<typeof detectMarketplaceFromUrl>
}

function aliExpressToScraped(
  mapped: ReturnType<typeof mapAliExpressGetProductResponse>,
  sourceUrl: string
): SupplierScrapedProduct {
  const priceEur = mapped.basePriceCents / 100
  const markup = 2.5
  const suggested = parseFloat((priceEur * markup).toFixed(2))
  return {
    title: mapped.name,
    description: mapped.description,
    ai_title: mapped.name,
    ai_description: mapped.description,
    price: priceEur,
    original_price: priceEur,
    currency: "EUR",
    images: mapped.images,
    videos: [],
    variants: [],
    colors: [],
    sizes: [],
    brand: "",
    category: "AliExpress",
    sku: `ae-${mapped.aliexpressProductId}`,
    stock: mapped.stock,
    shipping: {
      from_country: "China",
      delivery_time: "15-25 days",
      shipping_cost: 0,
      carrier: "",
    },
    reviews: {
      total: 0,
      average_rating: 0,
      breakdown: {},
      items: [],
      sentiment: "neutral",
    },
    specs: {},
    source_platform: "aliexpress",
    source_url: sourceUrl,
    basePrice: suggested,
    costPrice: priceEur,
    suggested_price: suggested,
    suggested_commission: 25,
    profit_per_sale: parseFloat((suggested - priceEur).toFixed(2)),
    roi: priceEur > 0 ? Math.round(((suggested - priceEur) / priceEur) * 100) : 0,
    tags: ["aliexpress", "import-agent"],
    quality_score: 70,
    is_duplicate: false,
    seo_keywords: [],
  }
}

async function suggestCategory(
  product: SupplierScrapedProduct,
  leafPaths: LeafPath[]
): Promise<ProductImportAgentCategory | null> {
  if (leafPaths.length === 0) return null
  const allowed = leafPaths.map((lp) => lp.breadcrumb)
  const { suggestions } = await classifyAffisellProduct(
    {
      title: product.title,
      description: product.description.slice(0, 1500),
      imageUrl: product.images[0] ?? null,
    },
    { allowedBreadcrumbs: allowed, leafPaths }
  )
  const top = suggestions[0]
  if (!top) return null
  return {
    leafId: top.leafId,
    breadcrumb: top.category,
    confidence: top.confidence,
    reason: top.reason,
  }
}

/** Full AI import pipeline: detect marketplace → fetch → Groq enrich → category. */
export async function runProductImportAgent(body: SupplierImportUrlBody): Promise<
  ProductImportAgentResult | ProductImportAgentError
> {
  const rawUrl = typeof body.url === "string" ? body.url.trim() : ""
  if (!rawUrl) {
    return { ok: false, error: "URL produit requise", status: 400 }
  }

  const marketplace = detectMarketplaceFromUrl(rawUrl)
  const steps: ProductImportAgentStep[] = ["detect"]
  const warnings: string[] = []
  let platform = marketplace.scrapePlatform
  let method = "agent"

  let product: SupplierScrapedProduct | null = null

  steps.push("fetch")

  const aeId = marketplace.preferAliExpressApi ? parseAliExpressProductId(rawUrl) : null
  const aeConfigured = getAliExpressConfigStatus().configured

  if (aeId && aeConfigured) {
    try {
      const client = await createAliExpressClient()
      const raw = await client.getProduct(aeId)
      const mapped = mapAliExpressGetProductResponse(raw, aeId)
      product = aliExpressToScraped(mapped, rawUrl)
      platform = "aliexpress"
      method = "aliexpress-api"
    } catch (e) {
      if (e instanceof AliExpressApiError) {
        return {
          ok: false,
          error: e.message,
          status: 502,
          marketplace,
        }
      }
      warnings.push("API AliExpress indisponible — tentative scraping.")
    }
  } else if (aeId && !aeConfigured) {
    warnings.push(
      "API AliExpress non configurée sur le serveur — import par scraping (moins fiable)."
    )
  }

  if (!product) {
    const scraped = await scrapeSupplierProductFromUrl(body, {
      allowAliExpressScrape: Boolean(aeId),
    })
    if (!scraped.ok) {
      return {
        ok: false,
        error: scraped.error,
        status: scraped.status,
        useAliExpressApi: scraped.useAliExpressApi,
        marketplace,
      }
    }
    product = scraped.product
    platform = scraped.platform
    method = scraped.method
    warnings.push(...scraped.warnings)
  }

  steps.push("enrich")
  let aiEnriched = false
  const enriched = await enrichScrapedProductWithAi(product, marketplace.label)
  if (enriched) {
    product = applyAiEnrichmentToScrapedProduct(product, enriched)
    aiEnriched = true
  } else if (!process.env.GROQ_API_KEY?.trim()) {
    warnings.push("GROQ_API_KEY absente — enrichissement IA désactivé.")
  }

  steps.push("categorize")
  let category: ProductImportAgentCategory | null = null
  try {
    const rows = await fetchAllCategoriesForBrowse(prisma)
    const { leafPaths } = buildCategoryBrowse(rows)
    category = await suggestCategory(product, leafPaths)
  } catch (e) {
    console.warn("[product-import-agent] category", {
      error: e instanceof Error ? e.message : String(e),
    })
    warnings.push("Catégorie non suggérée — choisissez-la manuellement.")
  }

  steps.push("done")

  console.log("[product-import-agent]", {
    marketplace: marketplace.id,
    method,
    aiEnriched,
    categoryLeaf: category?.leafId ?? null,
    imageCount: product.images.length,
  })

  return {
    ok: true,
    marketplace,
    product,
    platform,
    method,
    warnings,
    steps,
    aiEnriched,
    category,
  }
}
