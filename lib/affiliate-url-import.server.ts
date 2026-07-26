import { Prisma } from "@prisma/client"
import * as cheerio from "cheerio"

import { computeAffiliateListingMarginCents } from "@/lib/affiliate-listing-margin"
import { shopListingPath } from "@/lib/affiliate-routes"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import {
  DROPFORGE_MAX_DESC,
  DROPFORGE_MAX_IMAGES,
  buildDropForgeProductPersistFields,
  dropForgeIncompleteError,
  emptyDropForgeExtras,
  isDropForgeImportComplete,
  mergeScrapedProducts,
  type DropForgeCompletePreview,
} from "@/lib/dropforge-complete-import"
import { validateDropForgeProductUrl } from "@/lib/dropforge-product-url"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { psychologicalPrice } from "@/lib/import/smart-import-enricher"
import { detectMarketplaceFromUrl } from "@/lib/import-marketplace"
import { merchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"
import { syncProductVariants } from "@/lib/product-variant-sku"
import { runProductImportAgent } from "@/lib/product-import-agent"
import { prisma } from "@/lib/prisma"
import type { SupplierScrapedProduct } from "@/lib/supplier-import-url-handler"
import { normalizeImportBrand } from "@/lib/url-import-apply"

export const RESELLER_IMPORT_VAULT_EMAIL = "import-vault@affisell.internal"
export const RESELLER_URL_IMPORT_SOURCE = "reseller_url_import"

export type ResellerImportPreview = DropForgeCompletePreview

function asPreview(
  product: SupplierScrapedProduct,
  meta: {
    platform: string
    method: string
    sourceUrl: string
    marketplaceLabel: string
    warnings: string[]
    catalogProductId?: string
  }
): ResellerImportPreview {
  const cost = Math.max(0.01, Number(product.price) || Number(product.costPrice) || 0)
  const suggested =
    typeof product.suggested_price === "number" && product.suggested_price > cost
      ? product.suggested_price
      : cost > 0
        ? psychologicalPrice(cost * 2.8)
        : 0
  const images = (product.images ?? [])
    .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
    .slice(0, DROPFORGE_MAX_IMAGES)
  const videos = (product.videos ?? [])
    .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
    .slice(0, 6)
  const variants = (product.variants ?? []).slice(0, 80).map((v) => ({
    name: String(v.name || "").slice(0, 120),
    type: String(v.type || "").slice(0, 64),
    image: typeof v.image === "string" && /^https?:\/\//i.test(v.image) ? v.image : "",
    price: Math.max(0, Number(v.price) || 0),
    stock: Math.max(0, Math.round(Number(v.stock) || 0)),
    sku: String(v.sku || "").slice(0, 64),
    attributes:
      v.attributes && typeof v.attributes === "object"
        ? Object.fromEntries(
            Object.entries(v.attributes)
              .filter(([, val]) => typeof val === "string")
              .slice(0, 12)
          )
        : {},
  }))
  const colors = (product.colors ?? []).slice(0, 24).map((c) => ({
    name: String(c.name || "").slice(0, 64),
    image: typeof c.image === "string" && /^https?:\/\//i.test(c.image) ? c.image : "",
    hex: String(c.hex || "").slice(0, 16),
  }))
  const sizes = (product.sizes ?? [])
    .map((s) => (typeof s === "string" ? s : s?.name || s?.value || ""))
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 40)
  const specs: Record<string, string> = {}
  for (const [k, v] of Object.entries(product.specs ?? {})) {
    if (typeof v === "string" && v.trim()) specs[k.slice(0, 80)] = v.trim().slice(0, 500)
  }

  const preview: ResellerImportPreview = {
    title: (product.ai_title || product.title).slice(0, 200),
    description: (product.ai_description || product.description || product.title).slice(
      0,
      DROPFORGE_MAX_DESC
    ),
    images,
    videos,
    variants,
    colors,
    sizes,
    specs,
    shipping: {
      from_country: product.shipping?.from_country || "",
      delivery_time: product.shipping?.delivery_time || "",
      shipping_cost: Math.max(0, Number(product.shipping?.shipping_cost) || 0),
      carrier: product.shipping?.carrier || "",
    },
    tags: (product.tags ?? []).filter((t) => typeof t === "string").slice(0, 24),
    seoKeywords: (product.seo_keywords ?? [])
      .filter((t) => typeof t === "string")
      .slice(0, 24),
    sku: (product.sku || "").slice(0, 64),
    originalPrice: Math.max(0, Number(product.original_price) || 0),
    reviewCount: Math.max(0, Math.round(product.reviews?.total || 0)),
    reviewRating: Math.max(0, Number(product.reviews?.average_rating) || 0),
    costPrice: cost,
    suggestedPrice: suggested,
    profitPerSale: Math.max(0, Number((suggested - cost).toFixed(2))),
    currency: product.currency || "EUR",
    brand: normalizeImportBrand(product.brand || "", product.title),
    category: (product.category || "").slice(0, 120),
    stock: Math.max(0, Math.min(9999, Math.round(product.stock || 99))),
    platform: meta.platform,
    marketplaceLabel: meta.marketplaceLabel,
    method: meta.method,
    sourceUrl: meta.sourceUrl,
    warnings: meta.warnings,
    catalogProductId: meta.catalogProductId,
  }
  if (!isDropForgeImportComplete(preview)) {
    preview.partial = true
  }
  return preview
}

/** Idempotent platform supplier that owns URL-imported catalog rows for resellers. */
export async function ensureResellerImportVaultSupplier(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: RESELLER_IMPORT_VAULT_EMAIL },
    select: { id: true, role: true },
  })
  if (existing) {
    if (existing.role !== "SUPPLIER") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "SUPPLIER", name: "Affisell Import Vault" },
      })
    }
    return existing.id
  }

  const created = await prisma.user.create({
    data: {
      email: RESELLER_IMPORT_VAULT_EMAIL,
      name: "Affisell Import Vault",
      role: "SUPPLIER",
      isVerifiedSupplier: true,
      verifiedAt: new Date(),
    },
    select: { id: true },
  })
  console.log("[affiliate-url-import]", { result: "vault_created", supplierId: created.id })
  return created.id
}

async function matchCatalogProduct(url: string): Promise<{
  id: string
  name: string
  description: string
  images: string[]
  basePriceCents: number
  stock: number
} | null> {
  const aeId = parseAliExpressProductId(url)
  if (aeId) {
    const byAe = await prisma.product.findFirst({
      where: { aliexpressProductId: aeId, active: true, isDraft: false },
      select: {
        id: true,
        name: true,
        description: true,
        images: true,
        basePriceCents: true,
        stock: true,
      },
      orderBy: { updatedAt: "desc" },
    })
    if (byAe) return byAe
  }

  const byUrl = await prisma.product.findFirst({
    where: { sourceUrl: url, active: true, isDraft: false },
    select: {
      id: true,
      name: true,
      description: true,
      images: true,
      basePriceCents: true,
      stock: true,
    },
    orderBy: { updatedAt: "desc" },
  })
  return byUrl
}

/** Open Graph / Twitter cards — works on many storefronts without ScrapingBee. */
async function scrapeOpenGraphPreview(url: string): Promise<SupplierScrapedProduct | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    if (html.length < 200) return null
    const $ = cheerio.load(html)
    const pick = (...sels: string[]) => {
      for (const s of sels) {
        const v = $(s).attr("content")?.trim() || $(s).text().trim()
        if (v) return v
      }
      return ""
    }
    const title =
      pick('meta[property="og:title"]', 'meta[name="twitter:title"]') ||
      $("title").first().text().trim()
    if (!title || title.length < 3) return null
    const description =
      pick('meta[property="og:description"]', 'meta[name="description"]') || title
    const image =
      pick('meta[property="og:image"]', 'meta[name="twitter:image"]') || ""
    const priceRaw =
      pick(
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
        'meta[itemprop="price"]'
      ) || "0"
    const price = Math.max(0, parseFloat(priceRaw.replace(",", ".")) || 0) || 9.9
    const suggested = psychologicalPrice(price * 2.8)
    return {
      title: title.slice(0, 200),
      description: description.slice(0, 4000),
      ai_title: title.slice(0, 200),
      ai_description: description.slice(0, 4000),
      price,
      original_price: price,
      currency: "EUR",
      images: image && /^https?:\/\//i.test(image) ? [image] : [],
      videos: [],
      variants: [],
      colors: [],
      sizes: [],
      brand: "",
      category: "",
      sku: "",
      stock: 99,
      shipping: {
        from_country: "",
        delivery_time: "",
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
      source_platform: "universal",
      source_url: url,
      basePrice: suggested,
      costPrice: price,
      suggested_price: suggested,
      suggested_commission: 20,
      profit_per_sale: parseFloat((suggested - price).toFixed(2)),
      roi: price > 0 ? Math.round(((suggested - price) / price) * 100) : 0,
      tags: ["og-import"],
      quality_score: image && price > 0 ? 55 : 30,
      is_duplicate: false,
      seo_keywords: [],
    }
  } catch (e) {
    console.log("[affiliate-url-import]", {
      stage: "og_fallback",
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

export async function previewResellerUrlImport(rawUrl: string): Promise<
  | { ok: true; preview: ResellerImportPreview }
  | { ok: false; error: string; status: number; marketplaceLabel?: string }
> {
  const validated = validateDropForgeProductUrl(rawUrl)
  if (!validated.ok) {
    return { ok: false, error: validated.error, status: 400 }
  }
  const url = validated.url

  const market = detectMarketplaceFromUrl(url)

  const catalog = await matchCatalogProduct(url)
  if (catalog) {
    const cost = Math.max(0.01, catalog.basePriceCents / 100)
    const suggested = psychologicalPrice(cost * 2.8)
    const images = catalog.images
      .filter((u) => /^https?:\/\//i.test(u))
      .slice(0, DROPFORGE_MAX_IMAGES)
    const preview: ResellerImportPreview = {
      ...emptyDropForgeExtras(),
      title: catalog.name.slice(0, 200),
      description: (catalog.description || catalog.name).slice(0, DROPFORGE_MAX_DESC),
      images,
      costPrice: cost,
      suggestedPrice: suggested,
      profitPerSale: Math.max(0, Number((suggested - cost).toFixed(2))),
      currency: "EUR",
      brand: "Generic",
      category: market.label,
      stock: Math.max(0, catalog.stock),
      platform: market.scrapePlatform,
      marketplaceLabel: market.label,
      method: "catalog-match",
      sourceUrl: url,
      warnings: ["Produit déjà dans le catalogue Affisell — prêt à lister sur ta boutique."],
      catalogProductId: catalog.id,
    }
    if (!isDropForgeImportComplete(preview)) {
      return {
        ok: false,
        error: dropForgeIncompleteError(market.label),
        status: 422,
        marketplaceLabel: market.label,
      }
    }
    console.log("[affiliate-url-import]", {
      stage: "preview",
      result: "catalog_match",
      productId: catalog.id,
      images: images.length,
    })
    return { ok: true, preview }
  }

  const agent = await runProductImportAgent({
    url,
    options: { markup: 2.8, aiRewrite: false, fast: false },
  })

  const og = await scrapeOpenGraphPreview(url)

  let product: SupplierScrapedProduct | null = null
  let method = "agent"
  let platform: string = market.scrapePlatform
  const warnings: string[] = []

  if (agent.ok && og) {
    product = mergeScrapedProducts(agent.product, og)
    method = `${agent.method}+open-graph`
    platform = agent.platform
    warnings.push(...agent.warnings)
  } else if (agent.ok) {
    product = agent.product
    method = agent.method
    platform = agent.platform
    warnings.push(...agent.warnings)
  } else if (og) {
    product = og
    method = "open-graph"
    warnings.push(`Scan principal : ${agent.error}`)
  } else {
    console.log("[affiliate-url-import]", {
      stage: "preview",
      result: "incomplete",
      marketplaceLabel: market.label,
      error: agent.error.slice(0, 160),
    })
    return {
      ok: false,
      error: dropForgeIncompleteError(market.label),
      status: 422,
      marketplaceLabel: market.label,
    }
  }

  const preview = asPreview(product, {
    platform,
    method,
    sourceUrl: url,
    marketplaceLabel: market.label,
    warnings,
  })

  if (!isDropForgeImportComplete(preview)) {
    console.log("[affiliate-url-import]", {
      stage: "preview",
      result: "incomplete_fields",
      method,
      images: preview.images.length,
      costPrice: preview.costPrice,
    })
    return {
      ok: false,
      error: dropForgeIncompleteError(market.label),
      status: 422,
      marketplaceLabel: market.label,
    }
  }

  console.log("[affiliate-url-import]", {
    stage: "preview",
    result: "ok",
    method,
    marketplace: market.id,
    images: preview.images.length,
    variants: preview.variants.length,
    videos: preview.videos.length,
    specs: Object.keys(preview.specs).length,
  })

  return { ok: true, preview }
}

function sanitizeCommitSnapshot(
  raw: unknown,
  sourceUrl: string
): ResellerImportPreview | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const snapUrl = typeof o.sourceUrl === "string" ? o.sourceUrl.trim() : ""
  if (snapUrl !== sourceUrl) return null
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 200) : ""
  if (title.length < 2) return null
  const costPrice =
    typeof o.costPrice === "number" && Number.isFinite(o.costPrice)
      ? Math.max(0.01, o.costPrice)
      : null
  const suggestedPrice =
    typeof o.suggestedPrice === "number" && Number.isFinite(o.suggestedPrice)
      ? Math.max(0.02, o.suggestedPrice)
      : null
  if (costPrice == null || suggestedPrice == null) return null
  const images = Array.isArray(o.images)
    ? o.images
        .filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))
        .slice(0, DROPFORGE_MAX_IMAGES)
    : []
  const videos = Array.isArray(o.videos)
    ? o.videos
        .filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))
        .slice(0, 6)
    : []
  const market = detectMarketplaceFromUrl(sourceUrl)
  const specs: Record<string, string> = {}
  if (o.specs && typeof o.specs === "object" && !Array.isArray(o.specs)) {
    for (const [k, v] of Object.entries(o.specs as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) specs[k.slice(0, 80)] = v.trim().slice(0, 500)
    }
  }
  const shipRaw =
    o.shipping && typeof o.shipping === "object" && !Array.isArray(o.shipping)
      ? (o.shipping as Record<string, unknown>)
      : {}
  const preview: ResellerImportPreview = {
    ...emptyDropForgeExtras(),
    title,
    description:
      typeof o.description === "string"
        ? o.description.slice(0, DROPFORGE_MAX_DESC)
        : title,
    images,
    videos,
    variants: Array.isArray(o.variants)
      ? (o.variants as ResellerImportPreview["variants"]).slice(0, 80)
      : [],
    colors: Array.isArray(o.colors)
      ? (o.colors as ResellerImportPreview["colors"]).slice(0, 24)
      : [],
    sizes: Array.isArray(o.sizes)
      ? o.sizes.filter((s): s is string => typeof s === "string").slice(0, 40)
      : [],
    specs,
    shipping: {
      from_country: typeof shipRaw.from_country === "string" ? shipRaw.from_country : "",
      delivery_time: typeof shipRaw.delivery_time === "string" ? shipRaw.delivery_time : "",
      shipping_cost:
        typeof shipRaw.shipping_cost === "number" ? Math.max(0, shipRaw.shipping_cost) : 0,
      carrier: typeof shipRaw.carrier === "string" ? shipRaw.carrier : "",
    },
    tags: Array.isArray(o.tags)
      ? o.tags.filter((t): t is string => typeof t === "string").slice(0, 24)
      : [],
    seoKeywords: Array.isArray(o.seoKeywords)
      ? o.seoKeywords.filter((t): t is string => typeof t === "string").slice(0, 24)
      : [],
    sku: typeof o.sku === "string" ? o.sku.slice(0, 64) : "",
    originalPrice:
      typeof o.originalPrice === "number" && Number.isFinite(o.originalPrice)
        ? Math.max(0, o.originalPrice)
        : 0,
    reviewCount:
      typeof o.reviewCount === "number" ? Math.max(0, Math.round(o.reviewCount)) : 0,
    reviewRating:
      typeof o.reviewRating === "number" ? Math.max(0, o.reviewRating) : 0,
    costPrice,
    suggestedPrice,
    profitPerSale: Math.max(0, Number((suggestedPrice - costPrice).toFixed(2))),
    currency: typeof o.currency === "string" && o.currency ? o.currency : "EUR",
    brand:
      typeof o.brand === "string"
        ? normalizeImportBrand(o.brand, title)
        : "Generic",
    category:
      typeof o.category === "string" ? o.category.slice(0, 120) : market.label,
    stock:
      typeof o.stock === "number" && Number.isFinite(o.stock)
        ? Math.max(0, Math.min(9999, Math.round(o.stock)))
        : 99,
    platform:
      typeof o.platform === "string" && o.platform
        ? o.platform
        : market.scrapePlatform,
    marketplaceLabel:
      typeof o.marketplaceLabel === "string" && o.marketplaceLabel
        ? o.marketplaceLabel
        : market.label,
    method: typeof o.method === "string" && o.method ? o.method : "client-snapshot",
    sourceUrl,
    warnings: Array.isArray(o.warnings)
      ? o.warnings.filter((w): w is string => typeof w === "string").slice(0, 8)
      : [],
    catalogProductId:
      typeof o.catalogProductId === "string" ? o.catalogProductId : undefined,
  }
  if (!isDropForgeImportComplete(preview)) return null
  return preview
}

export async function commitResellerUrlImport(args: {
  affiliateId: string
  affiliateEmail: string
  affiliateName?: string | null
  sourceUrl: string
  sellingPriceEur?: number
  titleOverride?: string
  listLive?: boolean
  /** Avoid re-scrape (ScrapingBee quota / latency) — use the preview the user already saw. */
  snapshot?: unknown
}): Promise<
  | {
      ok: true
      productId: string
      affiliateProductId: string
      storeSlug: string
      shopHref: string
      editHref: string
      isListed: boolean
    }
  | { ok: false; error: string; status: number }
> {
  const validated = validateDropForgeProductUrl(args.sourceUrl)
  if (!validated.ok) {
    return { ok: false, error: validated.error, status: 400 }
  }
  const sourceUrl = validated.url

  const fromSnapshot = sanitizeCommitSnapshot(args.snapshot, sourceUrl)
  let preview: ResellerImportPreview

  if (fromSnapshot) {
    // Upgrade to catalog match when available (idempotent, no network scrape).
    const catalog = await matchCatalogProduct(sourceUrl)
    if (catalog) {
      const cost = Math.max(0.01, catalog.basePriceCents / 100)
      const suggested = psychologicalPrice(cost * 2.8)
      preview = {
        ...fromSnapshot,
        title: args.titleOverride?.trim() || catalog.name.slice(0, 200),
        description: (catalog.description || catalog.name).slice(0, 4000),
        images:
          catalog.images.filter((u) => /^https?:\/\//i.test(u)).slice(0, DROPFORGE_MAX_IMAGES)
            .length > 0
            ? catalog.images
                .filter((u) => /^https?:\/\//i.test(u))
                .slice(0, DROPFORGE_MAX_IMAGES)
            : fromSnapshot.images,
        costPrice: cost,
        suggestedPrice: suggested,
        profitPerSale: Math.max(0, Number((suggested - cost).toFixed(2))),
        stock: Math.max(0, catalog.stock),
        method: "catalog-match",
        catalogProductId: catalog.id,
        warnings: ["Produit catalogue Affisell — listage direct."],
      }
    } else {
      preview = fromSnapshot
      if (args.titleOverride?.trim()) {
        preview = { ...preview, title: args.titleOverride.trim().slice(0, 200) }
      }
    }
    console.log("[affiliate-url-import]", {
      stage: "commit",
      result: "snapshot",
      method: preview.method,
      partial: preview.partial === true,
    })
  } else {
    const previewRes = await previewResellerUrlImport(sourceUrl)
    if (!previewRes.ok) {
      return { ok: false, error: previewRes.error, status: previewRes.status }
    }
    preview = previewRes.preview
    if (args.titleOverride?.trim()) {
      preview = { ...preview, title: args.titleOverride.trim().slice(0, 200) }
    }
  }

  if (!isDropForgeImportComplete(preview)) {
    return {
      ok: false,
      error: dropForgeIncompleteError(preview.marketplaceLabel),
      status: 422,
    }
  }

  const supplierId = await ensureResellerImportVaultSupplier()
  const store = await ensureMerchantStore({
    userId: args.affiliateId,
    email: args.affiliateEmail,
    displayName: args.affiliateName,
  })

  const persist = buildDropForgeProductPersistFields(preview)
  const costCents = persist.basePriceCents
  const sellEur =
    typeof args.sellingPriceEur === "number" && Number.isFinite(args.sellingPriceEur)
      ? args.sellingPriceEur
      : preview.suggestedPrice
  const sellingPriceCents = Math.max(costCents + 1, Math.round(sellEur * 100))
  const marginCents = computeAffiliateListingMarginCents(sellingPriceCents, costCents)

  let listLive = args.listLive === true
  if (listLive) {
    const gate = await merchantVerificationGate(args.affiliateId)
    if (!gate.allowed) {
      listLive = false
      console.log("[affiliate-url-import]", {
        affiliateId: args.affiliateId,
        result: "forced_draft_kyc",
        status: gate.status,
        reason: gate.reason,
      })
    }
  }

  let productId = preview.catalogProductId ?? null

  if (!productId) {
    const aeId = parseAliExpressProductId(preview.sourceUrl)
    const existingProduct = await prisma.product.findFirst({
      where: {
        supplierId,
        OR: [
          { sourceUrl: preview.sourceUrl, importSource: RESELLER_URL_IMPORT_SOURCE },
          ...(aeId ? [{ aliexpressProductId: aeId }] : []),
        ],
      },
      select: { id: true },
    })

    const productData = {
      name: persist.name,
      description: persist.description,
      descriptionBullets: persist.descriptionBullets,
      descriptionIllustrationVideos: persist.descriptionIllustrationVideos,
      images: persist.images,
      colors: persist.colors,
      ...(persist.colorImages != null ? { colorImages: persist.colorImages } : {}),
      ...(persist.variants != null ? { variants: persist.variants } : {}),
      categories: preview.category ? [preview.category] : [],
      tags: persist.tags,
      basePriceCents: costCents,
      ...(persist.compareAt ? { compareAt: persist.compareAt } : {}),
      commissionRate: 15,
      stock: persist.stock,
      sourceUrl: preview.sourceUrl,
      importSource: RESELLER_URL_IMPORT_SOURCE,
      supplierTag: "reseller-import",
      shippingCountry: persist.shippingCountry,
      warehouseType: persist.warehouseType,
      deliveryMin: persist.deliveryMin,
      deliveryMax: persist.deliveryMax,
      shippingCost: persist.shippingCost,
      shipsFrom: persist.shipsFrom,
      hasVariants: persist.variantInputs.length > 0,
      ...(aeId ? { aliexpressProductId: aeId } : {}),
      active: true,
      isDraft: false,
    }

    const product = existingProduct
      ? await prisma.product.update({
          where: { id: existingProduct.id },
          data: productData,
          select: { id: true },
        })
      : await prisma.product.create({
          data: {
            supplierId,
            ...productData,
          },
          select: { id: true },
        })
    productId = product.id

    if (persist.attributes.length > 0) {
      for (const attr of persist.attributes) {
        await prisma.productAttribute.upsert({
          where: {
            productId_key: { productId, key: attr.key },
          },
          create: {
            productId,
            key: attr.key,
            value: attr.value,
            label: attr.label,
          },
          update: {
            value: attr.value,
            label: attr.label,
          },
        })
      }
    }

    if (persist.variantInputs.length > 0) {
      await prisma.$transaction(async (tx) => {
        await syncProductVariants(tx, productId!, true, persist.variantInputs)
      })
    }
  }

  const listing = await prisma.affiliateProduct.upsert({
    where: {
      affiliateId_productId: {
        affiliateId: args.affiliateId,
        productId,
      },
    },
    create: {
      affiliateId: args.affiliateId,
      productId,
      sellingPriceCents,
      marginCents,
      customTitle: preview.title,
      customDescription: preview.description,
      customImages: persist.images,
      isListed: listLive,
    },
    update: {
      sellingPriceCents,
      marginCents,
      customTitle: preview.title,
      customDescription: preview.description,
      customImages: persist.images,
      isListed: listLive,
    },
    select: { id: true, isListed: true },
  })

  console.log("[affiliate-url-import]", {
    affiliateId: args.affiliateId,
    productId,
    affiliateProductId: listing.id,
    platform: preview.platform,
    method: preview.method,
    isListed: listing.isListed,
    images: persist.images.length,
    variants: persist.variantInputs.length,
    specs: persist.attributes.length,
    videos: persist.descriptionIllustrationVideos.length,
    result: "committed",
  })

  return {
    ok: true,
    productId,
    affiliateProductId: listing.id,
    storeSlug: store.slug,
    shopHref: shopListingPath(store.slug, listing.id),
    editHref: `/dashboard/affiliate/catalog?productId=${encodeURIComponent(productId)}`,
    isListed: listing.isListed,
  }
}

/** Narrow Prisma Json noise for API responses. */
export function resellerImportPreviewJson(preview: ResellerImportPreview): Prisma.JsonObject {
  return preview as unknown as Prisma.JsonObject
}
