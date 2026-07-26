import { Prisma } from "@prisma/client"
import * as cheerio from "cheerio"

import { computeAffiliateListingMarginCents } from "@/lib/affiliate-listing-margin"
import { shopListingPath } from "@/lib/affiliate-routes"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { validateDropForgeProductUrl } from "@/lib/dropforge-product-url"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { psychologicalPrice } from "@/lib/import/smart-import-enricher"
import { detectMarketplaceFromUrl } from "@/lib/import-marketplace"
import { merchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"
import { runProductImportAgent } from "@/lib/product-import-agent"
import { prisma } from "@/lib/prisma"
import type { SupplierScrapedProduct } from "@/lib/supplier-import-url-handler"
import { normalizeImportBrand } from "@/lib/url-import-apply"

export const RESELLER_IMPORT_VAULT_EMAIL = "import-vault@affisell.internal"
export const RESELLER_URL_IMPORT_SOURCE = "reseller_url_import"

export type ResellerImportPreview = {
  title: string
  description: string
  images: string[]
  costPrice: number
  suggestedPrice: number
  profitPerSale: number
  currency: string
  brand: string
  category: string
  stock: number
  platform: string
  marketplaceLabel: string
  method: string
  sourceUrl: string
  warnings: string[]
  /** Incomplete fetch — still commitable as draft for the reseller to finish. */
  partial?: boolean
  catalogProductId?: string
}

function asPreview(
  product: SupplierScrapedProduct,
  meta: {
    platform: string
    method: string
    sourceUrl: string
    marketplaceLabel: string
    warnings: string[]
    partial?: boolean
    catalogProductId?: string
  }
): ResellerImportPreview {
  const cost = Math.max(0.01, Number(product.price) || 0.01)
  const suggested =
    typeof product.suggested_price === "number" && product.suggested_price > cost
      ? product.suggested_price
      : psychologicalPrice(cost * 2.8)
  return {
    title: product.title.slice(0, 200),
    description: (product.description || product.title).slice(0, 4000),
    images: (product.images ?? [])
      .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u))
      .slice(0, 12),
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
    partial: meta.partial,
    catalogProductId: meta.catalogProductId,
  }
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
      quality_score: 45,
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

function buildManualStubPreview(rawUrl: string): ResellerImportPreview {
  const market = detectMarketplaceFromUrl(rawUrl)
  let hostHint = market.label
  try {
    hostHint = new URL(rawUrl).hostname.replace(/^www\./, "")
  } catch {
    /* ignore */
  }
  const cost = 9.9
  const suggested = psychologicalPrice(cost * 2.8)
  return {
    title: `Produit importé · ${hostHint}`,
    description: `Brouillon créé depuis ${rawUrl}. Complète titre, images et prix dans ton catalogue Affisell.`,
    images: [],
    costPrice: cost,
    suggestedPrice: suggested,
    profitPerSale: Math.max(0, Number((suggested - cost).toFixed(2))),
    currency: "EUR",
    brand: "Generic",
    category: market.label,
    stock: 99,
    platform: market.scrapePlatform,
    marketplaceLabel: market.label,
    method: "manual-stub",
    sourceUrl: rawUrl.trim(),
    warnings: [
      "Aperçu partiel — la page source est protégée. Tu peux quand même créer un brouillon et finaliser la fiche.",
    ],
    partial: true,
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
    console.log("[affiliate-url-import]", {
      stage: "preview",
      result: "catalog_match",
      productId: catalog.id,
    })
    return {
      ok: true,
      preview: {
        title: catalog.name.slice(0, 200),
        description: (catalog.description || catalog.name).slice(0, 4000),
        images: catalog.images.filter((u) => /^https?:\/\//i.test(u)).slice(0, 12),
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
      },
    }
  }

  const agent = await runProductImportAgent({
    url,
    options: { markup: 2.8, aiRewrite: false, fast: true },
  })

  if (agent.ok) {
    console.log("[affiliate-url-import]", {
      stage: "preview",
      result: "ok",
      method: agent.method,
      marketplace: agent.marketplace.id,
    })
    return {
      ok: true,
      preview: asPreview(agent.product, {
        platform: agent.platform,
        method: agent.method,
        sourceUrl: url,
        marketplaceLabel: agent.marketplace.label,
        warnings: agent.warnings,
      }),
    }
  }

  const og = await scrapeOpenGraphPreview(url)
  if (og) {
    console.log("[affiliate-url-import]", {
      stage: "preview",
      result: "og_fallback",
      marketplaceLabel: market.label,
    })
    return {
      ok: true,
      preview: asPreview(og, {
        platform: market.scrapePlatform,
        method: "open-graph",
        sourceUrl: url,
        marketplaceLabel: market.label,
        warnings: [
          ...(agent.ok === false ? [`Scan principal : ${agent.error}`] : []),
          "Données partielles (Open Graph) — vérifie prix et images avant publication.",
        ],
        partial: true,
      }),
    }
  }

  console.log("[affiliate-url-import]", {
    stage: "preview",
    result: "manual_stub",
    marketplaceLabel: market.label,
    error: agent.ok === false ? agent.error.slice(0, 160) : "unknown",
  })

  return { ok: true, preview: buildManualStubPreview(url) }
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
        .slice(0, 12)
    : []
  const market = detectMarketplaceFromUrl(sourceUrl)
  return {
    title,
    description:
      typeof o.description === "string"
        ? o.description.slice(0, 4000)
        : title,
    images,
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
    partial: o.partial === true,
    catalogProductId:
      typeof o.catalogProductId === "string" ? o.catalogProductId : undefined,
  }
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
          catalog.images.filter((u) => /^https?:\/\//i.test(u)).slice(0, 12).length > 0
            ? catalog.images.filter((u) => /^https?:\/\//i.test(u)).slice(0, 12)
            : fromSnapshot.images,
        costPrice: cost,
        suggestedPrice: suggested,
        profitPerSale: Math.max(0, Number((suggested - cost).toFixed(2))),
        stock: Math.max(0, catalog.stock),
        method: "catalog-match",
        partial: false,
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

  const supplierId = await ensureResellerImportVaultSupplier()
  const store = await ensureMerchantStore({
    userId: args.affiliateId,
    email: args.affiliateEmail,
    displayName: args.affiliateName,
  })

  const costCents = Math.max(1, Math.round(preview.costPrice * 100))
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
    // Partial imports stay draft until images/title are complete
    if (preview.partial && preview.images.length === 0) {
      listLive = false
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
      name: preview.title,
      description: preview.description,
      images: preview.images,
      categories: preview.category ? [preview.category] : [],
      tags: ["reseller_url_import", preview.platform, preview.method],
      basePriceCents: costCents,
      commissionRate: 15,
      stock: preview.stock > 0 ? preview.stock : 99,
      sourceUrl: preview.sourceUrl,
      importSource: RESELLER_URL_IMPORT_SOURCE,
      supplierTag: "reseller-import",
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
      customImages: preview.images,
      isListed: listLive,
    },
    update: {
      sellingPriceCents,
      marginCents,
      customTitle: preview.title,
      customDescription: preview.description,
      customImages: preview.images,
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
