/** Phase 1 AE auto-buy: split platform fees (supplier wholesale + affiliate earnings). */

import { clampAffisellCommissionRateBps } from "@/lib/affisell-platform-commission"

/** 12 % on supplier wholesale (AE / catalog HT). */
export const DEFAULT_SUPPLIER_FEE_BPS = 1200

/** 20 % on affiliate earnings (commission + markup retained). */
export const DEFAULT_AFFILIATE_PLATFORM_FEE_BPS = 2000

export type Phase1OrderFees = {
  supplierFeeCents: number
  affiliateFeeCents: number
  /** Sum stored on `Order.affisellFeeCents` for reporting. */
  affisellFeeTotalCents: number
}

export function resolveSupplierFeeBps(bps: number | null | undefined): number {
  if (bps == null) return DEFAULT_SUPPLIER_FEE_BPS
  return clampAffisellCommissionRateBps(bps)
}

export function resolveAffiliatePlatformFeeBps(bps: number | null | undefined): number {
  if (bps == null) return DEFAULT_AFFILIATE_PLATFORM_FEE_BPS
  return clampAffisellCommissionRateBps(bps)
}

export function computePhase1OrderFees(opts: {
  wholesaleTotalCents: number
  affiliateCommissionCents: number
  affiliateMarginRetainedCents: number
  supplierFeeBps?: number | null
  affiliatePlatformFeeBps?: number | null
}): Phase1OrderFees {
  const wholesale = Math.max(0, Math.round(opts.wholesaleTotalCents))
  const affiliateEarnings = Math.max(
    0,
    Math.round(opts.affiliateCommissionCents) + Math.round(opts.affiliateMarginRetainedCents)
  )

  const supplierBps = resolveSupplierFeeBps(opts.supplierFeeBps)
  const affiliateBps = resolveAffiliatePlatformFeeBps(opts.affiliatePlatformFeeBps)

  const supplierFeeCents = Math.round((wholesale * supplierBps) / 10_000)
  const affiliateFeeCents = Math.round((affiliateEarnings * affiliateBps) / 10_000)
  const affisellFeeTotalCents = supplierFeeCents + affiliateFeeCents

  return { supplierFeeCents, affiliateFeeCents, affisellFeeTotalCents }
}

/** Affiliate markup after Phase 1 fee on earnings (supplier fee is on wholesale side). */
export function phase1AffiliateMarginRetainedCents(opts: {
  clientLineHtCents: number
  supplierPriceCents: number
  affiliateCommissionCents: number
  affiliateFeeCents: number
  fixedListingMarginCents?: number
}): number {
  if (opts.fixedListingMarginCents != null && opts.fixedListingMarginCents > 0) {
    return Math.max(0, Math.round(opts.fixedListingMarginCents))
  }
  return Math.max(
    0,
    Math.round(opts.clientLineHtCents) -
      Math.round(opts.supplierPriceCents) -
      Math.round(opts.affiliateCommissionCents) -
      Math.round(opts.affiliateFeeCents)
  )
}
