/** Phase 1 AE auto-buy: split platform fees (supplier wholesale + affiliate earnings). */

import { clampAffisellCommissionRateBps } from "@/lib/affisell-platform-commission"

/** @deprecated Use {@link DEFAULT_SUPPLIER_FEE_BPS_CATALOG} or {@link DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY}. */
export const DEFAULT_SUPPLIER_FEE_BPS = 1200

/** Catalogue natif : fournisseur expédie, pas d’auto-achat AE Affisell. */
export const DEFAULT_SUPPLIER_FEE_BPS_CATALOG = 1000

/** Auto-buy AE : carte Issuing, worker, mapping, risque ops. */
export const DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY = 1700

/** 20 % on affiliate earnings (commission + markup retained). */
export const DEFAULT_AFFILIATE_PLATFORM_FEE_BPS = 2000

export type Phase1OrderFees = {
  supplierFeeCents: number
  affiliateFeeCents: number
  /** Sum stored on `Order.affisellFeeCents` for reporting. */
  affisellFeeTotalCents: number
}

export function resolveSupplierFeeBps(bps: number | null | undefined): number {
  if (bps == null) return DEFAULT_SUPPLIER_FEE_BPS_CATALOG
  return clampAffisellCommissionRateBps(bps)
}

export function resolveAffiliatePlatformFeeBps(bps: number | null | undefined): number {
  if (bps == null) return DEFAULT_AFFILIATE_PLATFORM_FEE_BPS
  return clampAffisellCommissionRateBps(bps)
}

/** Gross partner gain before Affisell platform fee on affiliate earnings. */
export function grossAffiliateEarningsCents(
  affiliateCommissionCents: number,
  affiliateMarkupCents: number
): number {
  return Math.max(
    0,
    Math.round(affiliateCommissionCents) + Math.round(affiliateMarkupCents)
  )
}

/**
 * Connect / ledger net to affiliate.
 * Fixed listing margin: fee is on gross earnings and subtracted at payout.
 * Residual margin: fee already deducted from stored markup.
 */
/** Net Connect payout to supplier after partner commission and Affisell wholesale fee. */
export function netSupplierPayoutCents(args: {
  supplierPriceCents: number
  affiliateCommissionCents: number
  supplierFeeCents: number
}): number {
  return Math.max(
    0,
    Math.round(args.supplierPriceCents) -
      Math.round(args.affiliateCommissionCents) -
      Math.round(args.supplierFeeCents)
  )
}

export function netAffiliateTransferCents(args: {
  affiliatePayoutCents: number
  affiliateMarginRetainedCents: number
  affiliateFeeCents?: number | null
  affiliateMarginCents?: number | null
}): number {
  const commission = Math.max(0, Math.round(args.affiliatePayoutCents))
  const margin = Math.max(0, Math.round(args.affiliateMarginRetainedCents))
  const fee = Math.max(0, Math.round(args.affiliateFeeCents ?? 0))
  const gross = commission + margin
  const hasFixedListingMargin = (args.affiliateMarginCents ?? 0) > 0
  if (hasFixedListingMargin && fee > 0) {
    return Math.max(0, gross - fee)
  }
  return gross
}

export function computePhase1OrderFees(opts: {
  wholesaleTotalCents: number
  affiliateCommissionCents: number
  affiliateMarginRetainedCents: number
  /** Pre-resolved bps (prefer {@link resolveSupplierFeeBpsForOrder}). */
  supplierFeeBps?: number | null
  affiliatePlatformFeeBps?: number | null
}): Phase1OrderFees {
  const wholesale = Math.max(0, Math.round(opts.wholesaleTotalCents))
  const affiliateEarnings = Math.max(
    0,
    Math.round(opts.affiliateCommissionCents) + Math.round(opts.affiliateMarginRetainedCents)
  )

  const supplierBps =
    opts.supplierFeeBps != null
      ? resolveSupplierFeeBps(opts.supplierFeeBps)
      : DEFAULT_SUPPLIER_FEE_BPS_CATALOG
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
