import { Prisma } from "@prisma/client"

import { computeAffiliateListingMarginCents } from "@/lib/affiliate-listing-margin"
import { shopListingPath } from "@/lib/affiliate-routes"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { psychologicalPrice } from "@/lib/import/smart-import-enricher"
import { detectMarketplaceFromUrl } from "@/lib/import-marketplace"
import { merchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"
import { prisma } from "@/lib/prisma"
import {
  scrapeSupplierProductFromUrl,
  type SupplierScrapedProduct,
} from "@/lib/supplier-import-url-handler"
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
  /** Scrape failed — UI-only sample so the funnel still converts. */
  demo?: boolean
}

function asPreview(
  product: SupplierScrapedProduct,
  meta: {
    platform: string
    method: string
    sourceUrl: string
    marketplaceLabel: string
    warnings: string[]
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
    images: (product.images ?? []).filter((u) => typeof u === "string" && u.startsWith("http")).slice(0, 12),
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

/** Conversion fallback when ScrapingBee / source page blocks — never commit this row. */
export function buildDemoResellerImportPreview(rawUrl: string): ResellerImportPreview {
  const market = detectMarketplaceFromUrl(rawUrl)
  const cost = 12.9
  const suggested = psychologicalPrice(cost * 2.8)
  return {
    title: `Exemple · Best-seller ${market.label}`,
    description:
      "Aperçu démo Affisell — le scrape live est indisponible (quota / page bloquée). Crée ton compte : dès que le scrape repasse, ta vraie URL devient une fiche boutique.",
    images: [],
    costPrice: cost,
    suggestedPrice: suggested,
    profitPerSale: Math.max(0, Number((suggested - cost).toFixed(2))),
    currency: "EUR",
    brand: "Generic",
    category: "Marketplace",
    stock: 99,
    platform: market.scrapePlatform,
    marketplaceLabel: market.label,
    method: "demo-fallback",
    sourceUrl: rawUrl.trim(),
    warnings: [
      "Mode démo — scrape live indisponible. Les boutons publient seulement après un scan réel réussi.",
    ],
    demo: true,
  }
}

export async function previewResellerUrlImport(rawUrl: string): Promise<
  | { ok: true; preview: ResellerImportPreview }
  | { ok: false; error: string; status: number; marketplaceLabel?: string }
> {
  const url = rawUrl.trim()
  if (!url || !/^https?:\/\//i.test(url)) {
    return { ok: false, error: "URL invalide — colle un lien https://…", status: 400 }
  }

  const market = detectMarketplaceFromUrl(url)
  const scraped = await scrapeSupplierProductFromUrl(
    { url, options: { markup: 2.8, aiRewrite: false } },
    { allowAliExpressScrape: true }
  )

  if (!scraped.ok) {
    const soft =
      /ScrapingBee|limit reached|credits|blocked|Could not extract|timeout|fetch/i.test(
        scraped.error
      )
    if (soft) {
      console.log("[affiliate-url-import]", {
        stage: "preview",
        result: "demo_fallback",
        marketplaceLabel: market.label,
        error: scraped.error.slice(0, 160),
      })
      return { ok: true, preview: buildDemoResellerImportPreview(url) }
    }
    return {
      ok: false,
      error: scraped.error,
      status: scraped.status,
      marketplaceLabel: market.label,
    }
  }

  const warnings = [...(scraped.warnings ?? [])]
  if (market.id === "tiktok") {
    warnings.push(
      "TikTok Shop : import best-effort (page publique). Vérifie titre, prix et images avant publication."
    )
  }

  return {
    ok: true,
    preview: asPreview(scraped.product, {
      platform: scraped.platform,
      method: scraped.method,
      sourceUrl: url,
      marketplaceLabel: market.label,
      warnings,
    }),
  }
}

export async function commitResellerUrlImport(args: {
  affiliateId: string
  affiliateEmail: string
  affiliateName?: string | null
  sourceUrl: string
  sellingPriceEur?: number
  listLive?: boolean
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
  const previewRes = await previewResellerUrlImport(args.sourceUrl)
  if (!previewRes.ok) {
    return { ok: false, error: previewRes.error, status: previewRes.status }
  }
  const preview = previewRes.preview
  if (preview.demo) {
    return {
      ok: false,
      error:
        "Scan démo uniquement — colle une URL réelle quand le scrape est disponible, ou réessaie plus tard.",
      status: 409,
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
  }

  const existingProduct = await prisma.product.findFirst({
    where: {
      supplierId,
      sourceUrl: preview.sourceUrl,
      importSource: RESELLER_URL_IMPORT_SOURCE,
    },
    select: { id: true },
  })

  const productData = {
    name: preview.title,
    description: preview.description,
    images: preview.images,
    categories: preview.category ? [preview.category] : [],
    tags: ["reseller_url_import", preview.platform],
    basePriceCents: costCents,
    commissionRate: 15,
    stock: preview.stock > 0 ? preview.stock : 99,
    sourceUrl: preview.sourceUrl,
    importSource: RESELLER_URL_IMPORT_SOURCE,
    supplierTag: "reseller-import",
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

  const listing = await prisma.affiliateProduct.upsert({
    where: {
      affiliateId_productId: {
        affiliateId: args.affiliateId,
        productId: product.id,
      },
    },
    create: {
      affiliateId: args.affiliateId,
      productId: product.id,
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
    productId: product.id,
    affiliateProductId: listing.id,
    platform: preview.platform,
    isListed: listing.isListed,
    result: "committed",
  })

  return {
    ok: true,
    productId: product.id,
    affiliateProductId: listing.id,
    storeSlug: store.slug,
    shopHref: shopListingPath(store.slug, listing.id),
    editHref: `/dashboard/affiliate/catalog?productId=${encodeURIComponent(product.id)}`,
    isListed: listing.isListed,
  }
}

/** Narrow Prisma Json noise for API responses. */
export function resellerImportPreviewJson(preview: ResellerImportPreview): Prisma.JsonObject {
  return preview as unknown as Prisma.JsonObject
}
