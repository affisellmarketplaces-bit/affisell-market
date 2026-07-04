import { Prisma } from "@prisma/client"

import { suggestSafeMarginsAfterWholesaleIncrease } from "@/lib/affiliate-margin-auto-fix"
import { buildAffiliateVariantOptions } from "@/lib/affiliate-storefront-variants"
import {
  buildWholesaleSnapshot,
  listingMarginReviewIsResolved,
  parseListingVariantPricing,
} from "@/lib/affiliate-wholesale-change-guard"
import {
  buildVariantPricingFromMargins,
  marginEuroFromPrices,
  parseAffiliateVariantPricingJson,
  serializeVariantPricingForDb,
} from "@/lib/affiliate-variant-pricing"
import { prisma } from "@/lib/prisma"
import { revalidateAffiliateShopfront } from "@/lib/revalidate-affiliate-shopfront"

export const AFFILIATE_MARGIN_AUTO_FIX_BATCH_MAX = 20

export type MarginAutoFixApplyResult =
  | { ok: true; listingId: string; keysFixed: number; cleared: boolean }
  | { ok: false; listingId: string; reason: "not_found" | "not_needed" | "unresolved" | "no_options" }

function marginEuroByKeyFromListing(args: {
  options: ReturnType<typeof buildAffiliateVariantOptions>
  variantPricing: ReturnType<typeof parseAffiliateVariantPricingJson>
  globalMarginEuro: number | null
}): Record<string, string> {
  const out: Record<string, string> = {}
  for (const opt of args.options) {
    const saved = args.variantPricing[opt.key]
    if (saved?.marginCents != null && saved.marginCents >= 0) {
      out[opt.key] = (saved.marginCents / 100).toFixed(2)
    } else if (saved?.sellingPriceCents != null) {
      out[opt.key] = marginEuroFromPrices(opt.wholesaleCents, saved.sellingPriceCents).toFixed(2)
    } else if (args.globalMarginEuro != null && Number.isFinite(args.globalMarginEuro)) {
      out[opt.key] = args.globalMarginEuro.toFixed(2)
    } else {
      out[opt.key] = "0.00"
    }
  }
  return out
}

function promotedPickFromKeys(
  options: ReturnType<typeof buildAffiliateVariantOptions>,
  promotedVariantKeys: string[]
): Record<string, boolean> {
  const promoted = new Set(promotedVariantKeys.map((k) => k.trim().toLowerCase()))
  return Object.fromEntries(
    options.map((o) => [o.key, promoted.has(o.key.toLowerCase()) || promoted.size === 0])
  )
}

export async function applyMarginAutoFixToListing(args: {
  listingId: string
  affiliateId: string
}): Promise<MarginAutoFixApplyResult> {
  const listing = await prisma.affiliateProduct.findFirst({
    where: { id: args.listingId, affiliateId: args.affiliateId },
    select: {
      id: true,
      marginReviewNeeded: true,
      marginReviewVariantKeys: true,
      sellingPriceCents: true,
      variantPricing: true,
      promotedVariantKeys: true,
      marginCents: true,
      product: {
        select: {
          basePriceCents: true,
          variants: true,
          colors: true,
          hasVariants: true,
          productVariants: {
            select: {
              color: true,
              size: true,
              stock: true,
              supplierPrice: true,
              wholesalePriceCents: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  })

  if (!listing) {
    return { ok: false, listingId: args.listingId, reason: "not_found" }
  }
  if (!listing.marginReviewNeeded) {
    return { ok: false, listingId: listing.id, reason: "not_needed" }
  }

  const productRow = {
    colors: listing.product.colors,
    variants: listing.product.variants,
    basePriceCents: listing.product.basePriceCents,
    hasVariants: listing.product.hasVariants,
    productVariants: listing.product.productVariants,
  }

  const variantOptions = buildAffiliateVariantOptions(productRow)
  if (variantOptions.length === 0) {
    return { ok: false, listingId: listing.id, reason: "no_options" }
  }

  const globalMarginEuro =
    (listing.sellingPriceCents - listing.product.basePriceCents) / 100
  const parsedPricing = parseAffiliateVariantPricingJson(listing.variantPricing)
  const currentMarginEuroByKey = marginEuroByKeyFromListing({
    options: variantOptions,
    variantPricing: parsedPricing,
    globalMarginEuro,
  })

  const fix = suggestSafeMarginsAfterWholesaleIncrease({
    baseWholesaleCents: listing.product.basePriceCents,
    sellingPriceCents: listing.sellingPriceCents,
    variantPricing: listing.variantPricing,
    reviewVariantKeys: listing.marginReviewVariantKeys,
    options: variantOptions.map((o) => ({ key: o.key, wholesaleCents: o.wholesaleCents })),
    currentMarginEuroByKey,
  })

  const pick =
    listing.promotedVariantKeys.length > 0
      ? promotedPickFromKeys(variantOptions, listing.promotedVariantKeys)
      : Object.fromEntries(variantOptions.map((o) => [o.key, true]))
  const mergedMargins = { ...currentMarginEuroByKey, ...fix.marginEuroByKey }

  let nextSellingCents = listing.sellingPriceCents
  if (fix.referencePriceEUR) {
    const ref = Number(fix.referencePriceEUR)
    if (Number.isFinite(ref) && ref > 0) {
      nextSellingCents = Math.max(listing.sellingPriceCents, Math.round(ref * 100))
    }
  }

  const variantPricingMap =
    variantOptions.length > 1
      ? buildVariantPricingFromMargins({
          options: variantOptions.map((o) => ({
            key: o.key,
            wholesaleCents: o.wholesaleCents,
          })),
          pick,
          marginEuroByKey: mergedMargins,
        })
      : {}

  const nextVariantPricing = parseListingVariantPricing(
    variantOptions.length > 1 ? variantPricingMap : null
  )

  const wholesaleAfter = buildWholesaleSnapshot(productRow)
  const resolved = listingMarginReviewIsResolved({
    sellingPriceCents: nextSellingCents,
    variantPricing: nextVariantPricing,
    wholesaleAfter,
  })

  if (!resolved) {
    return { ok: false, listingId: listing.id, reason: "unresolved" }
  }

  const serialized = serializeVariantPricingForDb(variantPricingMap)
  const nextMarginCents = Math.max(0, nextSellingCents - listing.product.basePriceCents)

  await prisma.affiliateProduct.update({
    where: { id: listing.id },
    data: {
      sellingPriceCents: nextSellingCents,
      marginCents: nextMarginCents,
      ...(serialized
        ? { variantPricing: serialized as Prisma.InputJsonValue }
        : { variantPricing: Prisma.DbNull }),
      marginReviewNeeded: false,
      marginReviewVariantKeys: [],
      marginReviewAt: null,
      marginReviewAlertHash: null,
    },
  })

  console.log("[margin-auto-fix]", {
    listingId: listing.id,
    affiliateId: args.affiliateId,
    keysFixed: fix.keysFixed.length,
    result: "applied",
  })

  return {
    ok: true,
    listingId: listing.id,
    keysFixed: fix.keysFixed.length,
    cleared: true,
  }
}

export async function applyMarginAutoFixBatch(args: {
  affiliateId: string
  limit?: number
}): Promise<{
  attempted: number
  fixed: number
  skipped: number
  failures: Array<{ listingId: string; reason: string }>
}> {
  const limit = Math.min(
    AFFILIATE_MARGIN_AUTO_FIX_BATCH_MAX,
    Math.max(1, args.limit ?? AFFILIATE_MARGIN_AUTO_FIX_BATCH_MAX)
  )

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      affiliateId: args.affiliateId,
      marginReviewNeeded: true,
      isListed: true,
    },
    select: { id: true },
    orderBy: { marginReviewAt: "asc" },
    take: limit,
  })

  let fixed = 0
  let skipped = 0
  const failures: Array<{ listingId: string; reason: string }> = []

  for (const row of listings) {
    const result = await applyMarginAutoFixToListing({
      listingId: row.id,
      affiliateId: args.affiliateId,
    })
    if (result.ok) {
      fixed += 1
    } else if (result.reason === "not_needed") {
      skipped += 1
    } else {
      failures.push({ listingId: row.id, reason: result.reason })
    }
  }

  if (fixed > 0) {
    await revalidateAffiliateShopfront(args.affiliateId)
  }

  console.log("[margin-auto-fix]", {
    affiliateId: args.affiliateId,
    attempted: listings.length,
    fixed,
    skipped,
    failures: failures.length,
  })

  return {
    attempted: listings.length,
    fixed,
    skipped,
    failures,
  }
}
