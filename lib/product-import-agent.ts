import { AliExpressApiError, createAliExpressClient } from "@/lib/aliexpress-open-api"
import { mapAliExpressGetProductResponse } from "@/lib/aliexpress-product-map"
import { getAliExpressConfigStatus } from "@/lib/aliexpress-config"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { absolutizeCdnImageUrl } from "@/lib/cdn-image-url"
import { stripDescriptionImageMarkers, stripImportOptionsFromDescription } from "@/lib/description-rich-content"
import { classifyAffisellProduct } from "@/lib/ai/classify-product"
import {
  buildCategoryBrowse,
  fetchAllCategoriesForBrowse,
  type LeafPath,
} from "@/lib/category-browse"
import { parseAeProductSkusFromPayload } from "@/lib/fulfillment/ae-product-skus"
import {
  aeSkusToVariantPersist,
  type AeSkuVariantPersist,
} from "@/lib/fulfillment/ae-skus-to-product-variants"
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
  /** Ready-to-publish AE SKU matrix (Express / Instant Enlist). */
  skuVariants: AeSkuVariantPersist | null
}

export type ProductImportAgentError = {
  ok: false
  error: string
  status: number
  useAliExpressApi?: boolean
  marketplace?: ReturnType<typeof detectMarketplaceFromUrl>
}

function applyAeSkuMatrixToScraped(
  product: SupplierScrapedProduct,
  persist: AeSkuVariantPersist,
  markup: number
): SupplierScrapedProduct {
  if (!persist.hasVariants || persist.variantInputs.length === 0) {
    const colors = persist.colorImages.map((c) => ({
      name: c.color,
      image: c.image ? absolutizeCdnImageUrl(c.image) ?? c.image : "",
      hex: c.hex,
    }))
    const sizesFromBullets: Array<{ name: string; value: string }> = []
    return {
      ...product,
      colors: colors.length > 0 ? colors : product.colors,
      sizes: product.sizes.length > 0 ? product.sizes : sizesFromBullets,
      stock: persist.totalStock > 0 ? persist.totalStock : product.stock,
      tags:
        colors.length > 0
          ? Array.from(new Set([...product.tags, "ae-skus"]))
          : product.tags,
    }
  }

  const variants = persist.variantInputs.map((v) => {
    const img =
      typeof v.customData?.image === "string"
        ? absolutizeCdnImageUrl(v.customData.image) ?? v.customData.image
        : ""
    return {
      name: [v.color, v.size].filter(Boolean).join(" · ") || v.sku || "Variant",
      type: "Variant",
      image: typeof img === "string" ? img : "",
      price: v.supplierPrice,
      stock: v.stock,
      sku: v.sku ?? "",
      attributes: {
        ...(v.color ? { Couleur: v.color } : {}),
        ...(v.size ? { Taille: v.size } : {}),
      },
    }
  })

  const colors = persist.colorImages.map((c) => ({
    name: c.color,
    image: c.image ? absolutizeCdnImageUrl(c.image) ?? c.image : "",
    hex: c.hex,
  }))

  const sizes = [
    ...new Set(
      persist.variantInputs
        .map((v) => v.size)
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    ),
  ].map((name) => ({ name, value: name }))

  const optionLines = persist.variantBullets.slice(0, 24)
  const hasSkuMatrix = variants.length >= 2 || persist.hasVariants
  let description = stripImportOptionsFromDescription(product.description)
  // SKU options → variant matrix / step 2 — never dump raw AE lines into description.
  if (!hasSkuMatrix && optionLines.length > 0 && !/OPTIONS|VARIANTES/i.test(description)) {
    description = `${description}\n\nOPTIONS\n${optionLines.map((l) => `• ${l}`).join("\n")}`.slice(
      0,
      20_000
    )
  }

  const minEur =
    persist.minPriceCents > 0 ? persist.minPriceCents / 100 : product.price
  const suggested = parseFloat((minEur * markup).toFixed(2))
  const galleryExtra = colors.map((c) => c.image).filter((u) => /^https?:\/\//i.test(u))
  const images = [...product.images]
  const seen = new Set(images)
  for (const u of galleryExtra) {
    if (seen.has(u)) continue
    seen.add(u)
    images.push(u)
    if (images.length >= 40) break
  }

  return {
    ...product,
    description,
    ai_description: description,
    price: minEur,
    original_price: minEur,
    images,
    variants,
    colors,
    sizes,
    stock: persist.totalStock > 0 ? persist.totalStock : product.stock,
    basePrice: suggested,
    costPrice: minEur,
    suggested_price: suggested,
    profit_per_sale: parseFloat((suggested - minEur).toFixed(2)),
    roi: minEur > 0 ? Math.round(((suggested - minEur) / minEur) * 100) : product.roi,
    tags: Array.from(new Set([...product.tags, "ae-skus"])),
  }
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
    description: stripDescriptionImageMarkers(mapped.description),
    ai_title: mapped.name,
    ai_description: stripDescriptionImageMarkers(mapped.description),
    price: priceEur,
    original_price: priceEur,
    currency: "EUR",
    images: mapped.images,
    videos: mapped.videos ?? [],
    descriptionIllustrationImages: mapped.descriptionIllustrationImages ?? [],
    variants: [],
    colors: [],
    sizes: [],
    brand: mapped.brand ?? "",
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
    specs: mapped.specs ?? {},
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
  let skuVariants: AeSkuVariantPersist | null = null
  const markup =
    typeof body.options?.markup === "number" && body.options.markup > 0
      ? body.options.markup
      : 2.5

  steps.push("fetch")

  const aeId = marketplace.preferAliExpressApi ? parseAliExpressProductId(rawUrl) : null
  const aeConfigured = getAliExpressConfigStatus().configured

  if (aeId && aeConfigured) {
    try {
      const client = await createAliExpressClient()
      const raw = await client.getProduct(aeId)
      const mapped = mapAliExpressGetProductResponse(raw, aeId)
      product = aliExpressToScraped(mapped, rawUrl)
      const aeSkus = parseAeProductSkusFromPayload(raw, aeId)
      const persist = aeSkusToVariantPersist(aeSkus)
      skuVariants = persist
      product = applyAeSkuMatrixToScraped(product, persist, markup)
      // Absolutize any leftover protocol-relative gallery URLs
      product = {
        ...product,
        images: product.images
          .map((u) => absolutizeCdnImageUrl(u) ?? u)
          .filter((u) => /^https?:\/\//i.test(u)),
      }
      platform = "aliexpress"
      method = "aliexpress-api"
      if (product.images.length === 0) {
        warnings.push("Aucune image CDN — uploadez une photo ou réessayez l'URL.")
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push(
        e instanceof AliExpressApiError
          ? `API AliExpress : ${msg} — tentative scraping / aperçu partiel.`
          : "API AliExpress indisponible — tentative scraping."
      )
      console.log("[product-import-agent]", {
        stage: "aliexpress-api",
        result: "fallback",
        error: msg.slice(0, 160),
      })
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
  const fast = body.options?.fast === true
  if (!fast) {
    const enriched = await enrichScrapedProductWithAi(product, marketplace.label)
    if (enriched) {
      product = applyAiEnrichmentToScrapedProduct(product, enriched)
      aiEnriched = true
    } else if (!process.env.GROQ_API_KEY?.trim()) {
      warnings.push("GROQ_API_KEY absente — enrichissement IA désactivé.")
    }
  }

  // Always categorize — Express publish requires categoryId (fast skips only AI enrich).
  steps.push("categorize")
  let category: ProductImportAgentCategory | null = null
  try {
    const rows = await fetchAllCategoriesForBrowse(prisma)
    const { leafPaths } = buildCategoryBrowse(rows)
    category = await suggestCategory(product, leafPaths)
    if (!category?.leafId) {
      warnings.push("Catégorie non suggérée — choisissez-la manuellement.")
    }
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
    specCount: Object.keys(product.specs ?? {}).length,
    variantCount: product.variants?.length ?? 0,
    skuVariants: skuVariants?.hasVariants ?? false,
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
    skuVariants,
  }
}
