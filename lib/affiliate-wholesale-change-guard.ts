import { createHash } from "node:crypto"

import { buildAffiliateVariantOptions } from "@/lib/affiliate-storefront-variants"
import {
  parseAffiliateVariantPricingJson,
  type AffiliateVariantPricingMap,
} from "@/lib/affiliate-variant-pricing"

export type WholesaleSnapshot = {
  basePriceCents: number
  /** Variant label → wholesale HT cents */
  variantWholesaleCents: Record<string, number>
}

export type WholesaleIncrease = {
  key: string
  oldCents: number
  newCents: number
}

const BASE_KEY = "__BASE__"

export function buildWholesaleSnapshot(args: {
  basePriceCents: number
  variants: unknown
  colors?: string[]
  hasVariants?: boolean
  productVariants?: Array<{
    color: string | null
    size: string | null
    stock: number
    supplierPrice?: unknown
    wholesalePriceCents?: number | null
  }>
}): WholesaleSnapshot {
  const options = buildAffiliateVariantOptions({
    colors: args.colors ?? [],
    variants: args.variants,
    basePriceCents: args.basePriceCents,
    hasVariants: args.hasVariants,
    productVariants: args.productVariants,
  })
  const variantWholesaleCents: Record<string, number> = {}
  for (const opt of options) {
    variantWholesaleCents[opt.key] = opt.wholesaleCents
  }
  return {
    basePriceCents: Math.max(0, Math.round(args.basePriceCents)),
    variantWholesaleCents,
  }
}

export function wholesaleSnapshotHash(snapshot: WholesaleSnapshot): string {
  const rows = Object.entries(snapshot.variantWholesaleCents)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, c]) => `${k}:${c}`)
    .join("|")
  const raw = `${snapshot.basePriceCents}#${rows}`
  return createHash("sha256").update(raw).digest("hex").slice(0, 20)
}

export function detectWholesaleIncreases(
  before: WholesaleSnapshot,
  after: WholesaleSnapshot
): WholesaleIncrease[] {
  const out: WholesaleIncrease[] = []
  if (after.basePriceCents > before.basePriceCents) {
    out.push({
      key: BASE_KEY,
      oldCents: before.basePriceCents,
      newCents: after.basePriceCents,
    })
  }
  const keys = new Set([
    ...Object.keys(before.variantWholesaleCents),
    ...Object.keys(after.variantWholesaleCents),
  ])
  for (const key of keys) {
    const oldCents = before.variantWholesaleCents[key] ?? before.basePriceCents
    const newCents = after.variantWholesaleCents[key] ?? after.basePriceCents
    if (newCents > oldCents) {
      out.push({ key, oldCents, newCents })
    }
  }
  return out
}

export function wholesaleForKey(snapshot: WholesaleSnapshot, key: string): number {
  return snapshot.variantWholesaleCents[key] ?? snapshot.basePriceCents
}

export type MarginReviewEvaluation = {
  needed: boolean
  variantKeys: string[]
  atLoss: boolean
}

export function evaluateListingMarginReview(args: {
  sellingPriceCents: number
  variantPricing: AffiliateVariantPricingMap | null
  wholesaleAfter: WholesaleSnapshot
  increases: WholesaleIncrease[]
}): MarginReviewEvaluation {
  const increaseKeys = new Set(
    args.increases.filter((i) => i.key !== BASE_KEY).map((i) => i.key)
  )
  const baseIncreased = args.increases.some((i) => i.key === BASE_KEY)
  const pricing = args.variantPricing ?? {}
  const pricingKeys = Object.keys(pricing)
  const affected: string[] = []
  let atLoss = false

  if (pricingKeys.length > 0) {
    for (const key of pricingKeys) {
      const entry = pricing[key]
      if (!entry) continue
      const wholesale = wholesaleForKey(args.wholesaleAfter, key)
      if (entry.sellingPriceCents < wholesale) {
        affected.push(key)
        atLoss = true
      } else if (increaseKeys.has(key)) {
        affected.push(key)
      }
    }
  } else {
    const sell = Math.max(0, Math.round(args.sellingPriceCents))
    if (sell < args.wholesaleAfter.basePriceCents) {
      return { needed: true, variantKeys: [], atLoss: true }
    }
    if (baseIncreased) {
      return { needed: true, variantKeys: [], atLoss: false }
    }
  }

  const unique = [...new Set(affected)]
  return {
    needed: unique.length > 0 || atLoss,
    variantKeys: unique,
    atLoss,
  }
}

export function listingMarginReviewIsResolved(args: {
  sellingPriceCents: number
  variantPricing: AffiliateVariantPricingMap | null
  wholesaleAfter: WholesaleSnapshot
}): boolean {
  const pricing = args.variantPricing ?? {}
  if (Object.keys(pricing).length > 0) {
    for (const [key, entry] of Object.entries(pricing)) {
      const wholesale = wholesaleForKey(args.wholesaleAfter, key)
      if (entry.sellingPriceCents < wholesale) return false
    }
    return true
  }
  return args.sellingPriceCents >= args.wholesaleAfter.basePriceCents
}

export function parseListingVariantPricing(raw: unknown): AffiliateVariantPricingMap | null {
  const map = parseAffiliateVariantPricingJson(raw)
  return Object.keys(map).length > 0 ? map : null
}
