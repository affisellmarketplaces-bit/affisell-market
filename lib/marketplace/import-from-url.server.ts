import "server-only"

import { Prisma } from "@prisma/client"

import { computeAffiliateListingMarginCents } from "@/lib/affiliate-listing-margin"
import { ensureAffisellAutoBuySupplier } from "@/lib/auto-buy-platform-supplier"
import {
  buildDropForgeProductPersistFields,
  emptyDropForgeExtras,
  isDropForgeImportComplete,
  type DropForgeCompletePreview,
  type DropForgeSkuVariantsPayload,
} from "@/lib/dropforge-complete-import"
import { dropForgeImportFailureMessage } from "@/lib/dropforge-import-diagnostics"
import { ensureDropForgeSupplierLink } from "@/lib/dropforge-fulfillment"
import { slugifyHeading } from "@/lib/legal/slugify-heading"
import { listingPublicSegment } from "@/lib/listing-public-url-shared"
import {
  ensureMarketplaceImportAffiliate,
  MARKETPLACE_IMPORT_AFFILIATE_EMAIL,
} from "@/lib/marketplace/ensure-marketplace-import-affiliate"
import {
  applyMarketplaceAiToScrapedProduct,
  enrichMarketplaceImportWithAi,
} from "@/lib/marketplace/marketplace-import-ai-enrich"
import { normalizeAeImportUrl } from "@/lib/marketplace/normalize-ae-import-url"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { absolutizeCdnImageUrl } from "@/lib/cdn-image-url"
import { detectMarketplaceFromUrl } from "@/lib/import-marketplace"
import { runProductImportAgent } from "@/lib/product-import-agent"
import {
  marketplaceRetailPriceEurForOption,
  marketplaceSellingPriceCentsForOption,
  type ProductVariantsJson,
} from "@/lib/product-variants"
import { syncProductVariants } from "@/lib/product-variant-sku"
import { prisma } from "@/lib/prisma"
import type { SupplierScrapedProduct } from "@/lib/supplier-import-url-handler"
import { normalizeImportBrand } from "@/lib/url-import-apply"

import {
  computeMarketplaceBaseSellingPriceEur,
  MARKETPLACE_IMPORT_MARKUP,
  MARKETPLACE_URL_IMPORT_SOURCE,
} from "@/lib/marketplace/marketplace-import-pricing"

export type MarketplaceImportResult =
  | {
      ok: true
      productId: string
      listingId: string
      slug: string
      previewUrl: string
      adminProductUrl: string
      title: string
      imageUrl: string | null
      isShoeProduct: boolean
      sellingPriceEur: number
      method: string
      warnings: string[]
    }
  | { ok: false; error: string; status: number }

function asMarketplacePreview(
  product: SupplierScrapedProduct,
  meta: {
    platform: string
    method: string
    sourceUrl: string
    marketplaceLabel: string
    warnings: string[]
    categoryId?: string
    skuVariants?: DropForgeSkuVariantsPayload | null
  }
): DropForgeCompletePreview {
  const cost = Math.max(0.01, Number(product.price) || Number(product.costPrice) || 0)
  const suggested = computeMarketplaceBaseSellingPriceEur(cost)
  const images = (product.images ?? [])
    .map((u) => (typeof u === "string" ? absolutizeCdnImageUrl(u) ?? u : ""))
    .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
    .slice(0, 24)

  return {
    ...emptyDropForgeExtras(),
    title: (product.ai_title || product.title).slice(0, 200),
    description: (product.ai_description || product.description || product.title).slice(0, 8000),
    images,
    videos: (product.videos ?? [])
      .map((u) => (typeof u === "string" ? absolutizeCdnImageUrl(u) ?? u : ""))
      .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
      .slice(0, 6),
    variants: (product.variants ?? []).slice(0, 120).map((v) => ({
      name: String(v.name || "").slice(0, 120),
      type: String(v.type || "").slice(0, 64),
      image:
        typeof v.image === "string"
          ? absolutizeCdnImageUrl(v.image) ?? (/^https?:\/\//i.test(v.image) ? v.image : "")
          : "",
      price: Math.max(0, Number(v.price) || 0),
      stock: Math.max(0, Math.round(Number(v.stock) || 0)),
      sku: String(v.sku || "").slice(0, 64),
      attributes:
        v.attributes && typeof v.attributes === "object"
          ? Object.fromEntries(
              Object.entries(v.attributes)
                .filter(([, val]) => typeof val === "string")
                .slice(0, 24)
            )
          : {},
    })),
    colors: (product.colors ?? []).slice(0, 24).map((c) => ({
      name: String(c.name || "").slice(0, 64),
      image:
        typeof c.image === "string"
          ? absolutizeCdnImageUrl(c.image) ?? (/^https?:\/\//i.test(c.image) ? c.image : "")
          : "",
      hex: String(c.hex || "").slice(0, 16),
    })),
    sizes: (product.sizes ?? [])
      .map((s) => (typeof s === "string" ? s : s?.name || s?.value || ""))
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 40),
    specs: Object.fromEntries(
      Object.entries(product.specs ?? {})
        .filter(([, v]) => typeof v === "string" && v.trim())
        .slice(0, 40)
        .map(([k, v]) => [k.slice(0, 80), (v as string).trim().slice(0, 500)])
    ),
    shipping: {
      from_country: product.shipping?.from_country || "China",
      delivery_time: product.shipping?.delivery_time || "15-25 days",
      shipping_cost: Math.max(0, Number(product.shipping?.shipping_cost) || 0),
      carrier: product.shipping?.carrier || "",
    },
    tags: (product.tags ?? []).filter((t) => typeof t === "string").slice(0, 24),
    seoKeywords: (product.seo_keywords ?? [])
      .filter((t) => typeof t === "string")
      .slice(0, 24),
    sku: (product.sku || "").slice(0, 64),
    originalPrice: Math.max(0, Number(product.original_price) || cost),
    reviewCount: Math.max(0, Math.round(product.reviews?.total || 0)),
    reviewRating: Math.max(0, Number(product.reviews?.average_rating) || 0),
    costPrice: cost,
    suggestedPrice: suggested,
    profitPerSale: Math.max(0, Number((suggested - cost).toFixed(2))),
    currency: product.currency || "EUR",
    brand: normalizeImportBrand(product.brand || "", product.title),
    category: (product.category || "").slice(0, 120),
    categoryId: meta.categoryId,
    stock: Math.max(0, Math.min(9999, Math.round(product.stock || 99))),
    platform: meta.platform,
    marketplaceLabel: meta.marketplaceLabel,
    method: meta.method,
    sourceUrl: meta.sourceUrl,
    warnings: meta.warnings,
    skuVariants: meta.skuVariants ?? null,
    fulfillmentReady: true,
    fulfillmentReason: "aliexpress",
    aliexpressProductId: parseAliExpressProductId(meta.sourceUrl),
  }
}

async function resolveUniqueListingSlug(
  affiliateId: string,
  title: string,
  aeProductId: string
): Promise<string> {
  const base = slugifyHeading(title).slice(0, 64) || `ae-${aeProductId}`
  let candidate = base
  let n = 0
  while (n < 20) {
    const clash = await prisma.affiliateProduct.findFirst({
      where: { affiliateId, customSlug: candidate },
      select: { id: true },
    })
    if (!clash) return candidate
    n += 1
    candidate = `${base}-${n}`.slice(0, 64)
  }
  return `ae-${aeProductId}`.slice(0, 64)
}

function buildVariantPricingMap(args: {
  variantsJson: ProductVariantsJson | null
  productBasePriceCents: number
  listingSellingPriceCents: number
  baseRetailEur: number
}): Record<string, { sellingPriceCents: number; marginCents: number }> {
  const out: Record<string, { sellingPriceCents: number; marginCents: number }> = {}
  const rows = args.variantsJson?.variantRows ?? []
  for (const row of rows) {
    const optionName = row.name?.trim()
    if (!optionName) continue
    const sellingPriceCents = marketplaceSellingPriceCentsForOption({
      listingSellingPriceCents: args.listingSellingPriceCents,
      productBasePriceCents: args.productBasePriceCents,
      variants: args.variantsJson,
      optionName,
    })
    const wholesale =
      row.priceCents > 0 ? row.priceCents : Math.max(0, args.productBasePriceCents)
    out[optionName] = {
      sellingPriceCents,
      marginCents: Math.max(0, sellingPriceCents - wholesale),
    }
  }
  return out
}

/** Full pipeline: normalize → fetch → AI → pricing → DRAFT Product + listing. */
export async function importMarketplaceFromUrl(rawUrl: string): Promise<MarketplaceImportResult> {
  const normalized = normalizeAeImportUrl(rawUrl)
  if (!normalized) {
    return { ok: false, error: "URL AliExpress invalide — colle un lien item/…html", status: 400 }
  }

  const market = detectMarketplaceFromUrl(normalized.canonicalUrl)
  const warnings: string[] = []

  const agent = await runProductImportAgent({
    url: normalized.canonicalUrl,
    options: { markup: MARKETPLACE_IMPORT_MARKUP, fast: false },
  })

  if (!agent.ok) {
    return {
      ok: false,
      error: agent.error,
      status: agent.status >= 400 ? agent.status : 422,
    }
  }

  let product = agent.product
  warnings.push(...agent.warnings)

  const ai = await enrichMarketplaceImportWithAi(product)
  let isShoeProduct = false
  let descriptionBullets: string[] = []

  if (ai) {
    product = applyMarketplaceAiToScrapedProduct(product, ai)
    isShoeProduct = ai.isShoeProduct
    descriptionBullets = ai.bullets
  } else {
    warnings.push("GROQ_API_KEY absente — titre/description source conservés.")
    isShoeProduct = product.tags.some((t) => t === "shoe-product")
  }

  let skuVariants: DropForgeSkuVariantsPayload | null = null
  if (agent.skuVariants) {
    skuVariants = {
      hasVariants: agent.skuVariants.hasVariants,
      variants: agent.skuVariants.variantInputs,
      colors: agent.skuVariants.colors,
      colorImages: agent.skuVariants.colorImages.map((c) => ({
        color: c.color,
        hex: c.hex,
        image: c.image
          ? absolutizeCdnImageUrl(c.image) ?? (/^https?:\/\//i.test(c.image) ? c.image : "")
          : "",
      })),
      totalStock: agent.skuVariants.totalStock,
    }
  }

  const preview = asMarketplacePreview(product, {
    platform: agent.platform,
    method: agent.method,
    sourceUrl: normalized.canonicalUrl,
    marketplaceLabel: market.label,
    warnings,
    categoryId: agent.category?.leafId ?? undefined,
    skuVariants,
  })

  if (!isDropForgeImportComplete(preview)) {
    return {
      ok: false,
      error: await dropForgeImportFailureMessage(preview.marketplaceLabel),
      status: 422,
    }
  }

  const supplier = await ensureAffisellAutoBuySupplier()
  const affiliate = await ensureMarketplaceImportAffiliate()
  const persist = buildDropForgeProductPersistFields(preview)
  const costCents = persist.basePriceCents
  const sellingPriceEur = computeMarketplaceBaseSellingPriceEur(preview.costPrice)
  const sellingPriceCents = Math.max(costCents + 1, Math.round(sellingPriceEur * 100))
  const marginCents = computeAffiliateListingMarginCents(sellingPriceCents, costCents)

  const baseRetailEur =
    marketplaceRetailPriceEurForOption({
      retailPriceEur: Math.max(preview.originalPrice, sellingPriceEur * 1.25),
      productBasePriceCents: costCents,
      variants: (persist.variants as ProductVariantsJson | undefined) ?? null,
      optionName: null,
    }) ?? Math.max(preview.originalPrice, sellingPriceEur * 1.25)

  const compareAt =
    baseRetailEur > sellingPriceEur
      ? new Prisma.Decimal(baseRetailEur.toFixed(2))
      : null

  const aeId = normalized.productId
  const existingProduct = await prisma.product.findFirst({
    where: {
      supplierId: supplier.id,
      OR: [
        { sourceUrl: normalized.canonicalUrl, importSource: MARKETPLACE_URL_IMPORT_SOURCE },
        { aliexpressProductId: aeId },
      ],
    },
    select: { id: true },
  })

  const productData = {
    name: persist.name,
    description: persist.description,
    descriptionBullets:
      descriptionBullets.length > 0 ? descriptionBullets : persist.descriptionBullets,
    descriptionIllustrationVideos: persist.descriptionIllustrationVideos,
    images: persist.images,
    colors: persist.colors,
    ...(persist.colorImages != null ? { colorImages: persist.colorImages } : {}),
    ...(persist.variants != null ? { variants: persist.variants } : {}),
    categories: preview.category ? [preview.category] : [],
    tags: Array.from(new Set([...persist.tags, MARKETPLACE_URL_IMPORT_SOURCE])),
    basePriceCents: costCents,
    ...(compareAt ? { compareAt } : {}),
    commissionRate: 15,
    stock: persist.stock,
    sourceUrl: normalized.canonicalUrl,
    importSource: MARKETPLACE_URL_IMPORT_SOURCE,
    supplierTag: "marketplace-import",
    shippingCountry: persist.shippingCountry,
    warehouseType: persist.warehouseType,
    deliveryMin: persist.deliveryMin,
    deliveryMax: persist.deliveryMax,
    shippingCost: persist.shippingCost,
    shipsFrom: persist.shipsFrom,
    hasVariants: persist.variantInputs.length > 0,
    aliexpressProductId: aeId,
    autoFulfill: true,
    autoBuyEnabled: true,
    active: false,
    isDraft: true,
    averageRating: preview.reviewRating > 0 ? preview.reviewRating : undefined,
    reviewCount: preview.reviewCount > 0 ? preview.reviewCount : undefined,
    tryOnEnabled: isShoeProduct,
    ...(agent.category?.leafId ? { categoryId: agent.category.leafId } : {}),
  }

  const savedProduct = existingProduct
    ? await prisma.product.update({
        where: { id: existingProduct.id },
        data: productData,
        select: { id: true },
      })
    : await prisma.product.create({
        data: {
          supplierId: supplier.id,
          ...productData,
        },
        select: { id: true },
      })

  const productId = savedProduct.id

  if (persist.attributes.length > 0) {
    for (const attr of persist.attributes) {
      await prisma.productAttribute.upsert({
        where: { productId_key: { productId, key: attr.key } },
        create: { productId, key: attr.key, value: attr.value, label: attr.label },
        update: { value: attr.value, label: attr.label },
      })
    }
  }

  if (persist.variantInputs.length > 0) {
    await prisma.$transaction(async (tx) => {
      await syncProductVariants(tx, productId, true, persist.variantInputs)
    })
  }

  await ensureDropForgeSupplierLink({
    productId,
    sourceUrl: normalized.canonicalUrl,
    aeProductId: aeId,
    aePriceCents: costCents,
  })

  const customSlug = await resolveUniqueListingSlug(affiliate.id, preview.title, aeId)
  const variantsJson = (persist.variants as ProductVariantsJson | undefined) ?? null
  const variantPricing = buildVariantPricingMap({
    variantsJson,
    productBasePriceCents: costCents,
    listingSellingPriceCents: sellingPriceCents,
    baseRetailEur,
  })

  const listing = await prisma.affiliateProduct.upsert({
    where: {
      affiliateId_productId: {
        affiliateId: affiliate.id,
        productId,
      },
    },
    create: {
      affiliateId: affiliate.id,
      productId,
      sellingPriceCents,
      marginCents,
      customTitle: preview.title,
      customDescription: preview.description,
      customImages: persist.images,
      customSlug,
      isListed: false,
      ...(Object.keys(variantPricing).length > 0
        ? { variantPricing: variantPricing as Prisma.InputJsonValue }
        : {}),
    },
    update: {
      sellingPriceCents,
      marginCents,
      customTitle: preview.title,
      customDescription: preview.description,
      customImages: persist.images,
      customSlug,
      isListed: false,
      ...(Object.keys(variantPricing).length > 0
        ? { variantPricing: variantPricing as Prisma.InputJsonValue }
        : {}),
    },
    select: { id: true },
  })

  const slug = listingPublicSegment(listing.id, customSlug)
  const previewUrl = `/marketplace/${slug}?preview=affiliate`

  console.log("[marketplace-import]", {
    productId,
    listingId: listing.id,
    aeProductId: aeId,
    method: agent.method,
    isShoeProduct,
    sellingPriceEur,
    variants: persist.variantInputs.length,
    result: "draft_created",
  })

  return {
    ok: true,
    productId,
    listingId: listing.id,
    slug,
    previewUrl,
    adminProductUrl: `/admin/products/${productId}`,
    title: preview.title,
    imageUrl: persist.images[0] ?? null,
    isShoeProduct,
    sellingPriceEur,
    method: agent.method,
    warnings,
  }
}

export async function publishMarketplaceImport(args: {
  productId?: string
  listingId?: string
}): Promise<
  | { ok: true; productId: string; listingId: string; previewUrl: string; slug: string }
  | { ok: false; error: string; status: number }
> {
  const productId = args.productId?.trim()
  const listingId = args.listingId?.trim()
  if (!productId && !listingId) {
    return { ok: false, error: "productId ou listingId requis", status: 400 }
  }

  const listing = await prisma.affiliateProduct.findFirst({
    where: listingId ? { id: listingId } : { productId: productId! },
    select: {
      id: true,
      productId: true,
      customSlug: true,
      affiliate: { select: { email: true } },
      product: {
        select: {
          id: true,
          importSource: true,
          isDraft: true,
          active: true,
        },
      },
    },
  })

  if (!listing?.product) {
    return { ok: false, error: "Listing introuvable", status: 404 }
  }

  if (listing.affiliate.email !== MARKETPLACE_IMPORT_AFFILIATE_EMAIL) {
    return { ok: false, error: "Listing non éligible à la publication marketplace", status: 403 }
  }

  await prisma.$transaction([
    prisma.product.update({
      where: { id: listing.productId },
      data: { active: true, isDraft: false },
    }),
    prisma.affiliateProduct.update({
      where: { id: listing.id },
      data: { isListed: true },
    }),
  ])

  const slug = listingPublicSegment(listing.id, listing.customSlug)
  const previewUrl = `/marketplace/${slug}`

  console.log("[marketplace-import]", {
    productId: listing.productId,
    listingId: listing.id,
    result: "published",
  })

  return {
    ok: true,
    productId: listing.productId,
    listingId: listing.id,
    previewUrl,
    slug,
  }
}
