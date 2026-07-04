import {
  buildWholesaleSnapshot,
  detectWholesaleIncreases,
  evaluateListingMarginReview,
  parseListingVariantPricing,
  type WholesaleSnapshot,
} from "@/lib/affiliate-wholesale-change-guard"
import { captureWholesaleSnapshotFromProductRow } from "@/lib/affiliate-wholesale-change-notify"
import { parseProductVariantsFromBody } from "@/lib/product-variant-sku"
import { parseVariantsPayload } from "@/lib/product-variants"

export type SupplierWholesaleChangePreview = {
  hasIncrease: boolean
  affiliateListingsLive: number
  listingsAtRisk: number
  atLossCount: number
  increaseCount: number
}

type ExistingProductRow = {
  basePriceCents: number
  variants: unknown
  colors: string[]
  hasVariants: boolean
  productVariants: Array<{
    color: string | null
    size: string | null
    stock: number
    supplierPrice?: unknown
    wholesalePriceCents?: number | null
  }>
}

export function buildWholesaleAfterFromSupplierDraft(
  existing: ExistingProductRow,
  rawBody: Record<string, unknown>
): WholesaleSnapshot {
  const variantPatch = parseProductVariantsFromBody(rawBody)
  const hasVariants =
    "error" in variantPatch ? existing.hasVariants : variantPatch.hasVariants
  const variants =
    "error" in variantPatch ? [] : variantPatch.variants

  let basePriceCents = existing.basePriceCents
  if (!hasVariants) {
    const price = Number(rawBody.price)
    if (Number.isFinite(price) && price > 0) {
      basePriceCents = Math.max(100, Math.round(price * 100))
    }
  } else if (variants.length > 0) {
    const minSupplier = Math.min(...variants.map((v) => v.supplierPrice))
    if (Number.isFinite(minSupplier) && minSupplier > 0) {
      basePriceCents = Math.max(100, Math.round(minSupplier * 100))
    }
  }

  let variantsJson: unknown = existing.variants
  if (
    rawBody.listingVariants &&
    typeof rawBody.listingVariants === "object" &&
    !Array.isArray(rawBody.listingVariants)
  ) {
    const existingVariants = parseVariantsPayload(existing.variants) ?? {}
    const incoming = rawBody.listingVariants as Record<string, unknown>
    variantsJson = {
      ...existingVariants,
      ...incoming,
      variantRows: incoming.variantRows ?? existingVariants.variantRows,
    }
  }

  const productVariants =
    hasVariants && variants.length > 0
      ? variants.map((v) => ({
          color: v.color,
          size: v.size,
          stock: v.stock,
          supplierPrice: v.supplierPrice,
          wholesalePriceCents: Math.max(100, Math.round(v.supplierPrice * 100)),
        }))
      : existing.productVariants

  return buildWholesaleSnapshot({
    basePriceCents,
    variants: variantsJson,
    colors: existing.colors,
    hasVariants,
    productVariants,
  })
}

export function previewWholesaleChangeFromSnapshots(args: {
  before: WholesaleSnapshot
  after: WholesaleSnapshot
  listings: Array<{
    sellingPriceCents: number
    variantPricing: unknown
  }>
}): SupplierWholesaleChangePreview {
  const increases = detectWholesaleIncreases(args.before, args.after)
  if (increases.length === 0) {
    return {
      hasIncrease: false,
      affiliateListingsLive: args.listings.length,
      listingsAtRisk: 0,
      atLossCount: 0,
      increaseCount: 0,
    }
  }

  let listingsAtRisk = 0
  let atLossCount = 0
  for (const listing of args.listings) {
    const review = evaluateListingMarginReview({
      sellingPriceCents: listing.sellingPriceCents,
      variantPricing: parseListingVariantPricing(listing.variantPricing),
      wholesaleAfter: args.after,
      increases,
    })
    if (review.needed) listingsAtRisk += 1
    if (review.atLoss) atLossCount += 1
  }

  return {
    hasIncrease: true,
    affiliateListingsLive: args.listings.length,
    listingsAtRisk,
    atLossCount,
    increaseCount: increases.length,
  }
}

export function previewWholesaleChangeFromDraft(
  existing: ExistingProductRow,
  rawBody: Record<string, unknown>,
  listings: Array<{ sellingPriceCents: number; variantPricing: unknown }>
): SupplierWholesaleChangePreview {
  const before = captureWholesaleSnapshotFromProductRow(existing)
  const after = buildWholesaleAfterFromSupplierDraft(existing, rawBody)
  return previewWholesaleChangeFromSnapshots({ before, after, listings })
}
