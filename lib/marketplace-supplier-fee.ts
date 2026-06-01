import {
  DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY,
  DEFAULT_SUPPLIER_FEE_BPS_CATALOG,
  computePhase1OrderFees,
  netSupplierPayoutCents,
  resolveSupplierFeeBps,
} from "@/lib/marketplace-phase1-fees"

export { netSupplierPayoutCents } from "@/lib/marketplace-phase1-fees"

export type SupplierFeeMode = "catalog" | "auto_buy"

export type SupplierFeeUserOverrides = {
  /** Legacy: overrides both modes when set. */
  supplierFeeBps?: number | null
  supplierFeeBpsCatalog?: number | null
  supplierFeeBpsAutoBuy?: number | null
}

export type SupplierLinkAutoBuyHint = {
  isActive: boolean
  autoBuyEnabled: boolean
} | null

/** True when this line will use Affisell AE auto-buy (active SupplierLink + toggle). */
export function orderUsesAffisellAutoBuy(input: {
  supplierLink: SupplierLinkAutoBuyHint
  productAutoBuyEnabled?: boolean
}): boolean {
  const link = input.supplierLink
  if (!link?.isActive) return false
  return link.autoBuyEnabled || Boolean(input.productAutoBuyEnabled)
}

export function supplierFeeModeFromAutoBuy(usesAutoBuy: boolean): SupplierFeeMode {
  return usesAutoBuy ? "auto_buy" : "catalog"
}

/** Prefer checkout snapshot; fall back to live SupplierLink + product toggle. */
export function resolveOrderUsesAffisellAutoBuy(input: {
  usesAffisellAutoBuy?: boolean | null
  supplierLink?: SupplierLinkAutoBuyHint
  productAutoBuyEnabled?: boolean
}): boolean {
  if (input.usesAffisellAutoBuy === true || input.usesAffisellAutoBuy === false) {
    return input.usesAffisellAutoBuy
  }
  return orderUsesAffisellAutoBuy({
    supplierLink: input.supplierLink ?? null,
    productAutoBuyEnabled: input.productAutoBuyEnabled,
  })
}

/** Resolve supplier-side Affisell fee (bps) for a paid order line. */
export function resolveSupplierFeeBpsForOrder(input: {
  usesAffisellAutoBuy: boolean
  supplier: SupplierFeeUserOverrides
}): number {
  const { supplier, usesAffisellAutoBuy } = input

  if (supplier.supplierFeeBps != null) {
    return resolveSupplierFeeBps(supplier.supplierFeeBps)
  }

  if (usesAffisellAutoBuy && supplier.supplierFeeBpsAutoBuy != null) {
    return resolveSupplierFeeBps(supplier.supplierFeeBpsAutoBuy)
  }

  if (!usesAffisellAutoBuy && supplier.supplierFeeBpsCatalog != null) {
    return resolveSupplierFeeBps(supplier.supplierFeeBpsCatalog)
  }

  return usesAffisellAutoBuy
    ? DEFAULT_SUPPLIER_FEE_BPS_AUTO_BUY
    : DEFAULT_SUPPLIER_FEE_BPS_CATALOG
}

/**
 * HT wholesale base for supplier platform fee:
 * - Catalogue: % of supplier catalog wholesale (supplier ships).
 * - Auto-buy: % of AE wholesale snapshot when present.
 */
export function wholesaleCentsForSupplierPlatformFee(input: {
  usesAffisellAutoBuy: boolean
  supplierPriceCents: number
  aeWholesaleCents?: number | null
}): number {
  if (
    input.usesAffisellAutoBuy &&
    input.aeWholesaleCents != null &&
    input.aeWholesaleCents > 0
  ) {
    return Math.round(input.aeWholesaleCents)
  }
  return Math.max(0, Math.round(input.supplierPriceCents))
}

export type ResolveOrderSupplierSettlementInput = {
  usesAffisellAutoBuy?: boolean | null
  supplierLink?: SupplierLinkAutoBuyHint
  productAutoBuyEnabled?: boolean
  supplier: SupplierFeeUserOverrides
  supplierPriceCents?: number | null
  basePriceCents: number
  affiliatePayoutCents?: number | null
  aeWholesaleCents?: number | null
  supplierFeeCents?: number | null
  supplierPayoutCents?: number | null
  supplierCommissionRateBps?: number | null
}

export type OrderSupplierSettlement = {
  usesAffisellAutoBuy: boolean
  supplierFeeBps: number
  supplierFeeCents: number
  supplierNetPayoutCents: number
  wholesaleForFeeCents: number
}

/** Resolve supplier platform fee + net payout from order snapshot (idempotent). */
export function resolveOrderSupplierSettlement(
  input: ResolveOrderSupplierSettlementInput
): OrderSupplierSettlement {
  const usesAffisellAutoBuy = resolveOrderUsesAffisellAutoBuy(input)
  const supplierPrice = Math.max(
    0,
    Math.round(input.supplierPriceCents ?? input.basePriceCents)
  )
  const bps = Math.max(0, Math.round(input.supplierCommissionRateBps ?? 0))
  const affiliateCommission =
    bps > 0
      ? Math.round((supplierPrice * bps) / 10_000)
      : Math.max(0, Math.round(input.affiliatePayoutCents ?? 0))

  const wholesaleForFee = wholesaleCentsForSupplierPlatformFee({
    usesAffisellAutoBuy,
    supplierPriceCents: supplierPrice,
    aeWholesaleCents: input.aeWholesaleCents,
  })

  const supplierFeeBps = resolveSupplierFeeBpsForOrder({
    usesAffisellAutoBuy,
    supplier: input.supplier,
  })

  const hasFrozenMode = input.usesAffisellAutoBuy === true || input.usesAffisellAutoBuy === false
  const storedFee = Math.max(0, Math.round(input.supplierFeeCents ?? 0))
  const supplierFeeCents =
    hasFrozenMode && storedFee > 0
      ? storedFee
      : Math.round((wholesaleForFee * supplierFeeBps) / 10_000)

  const supplierNetPayoutCents = netSupplierPayoutCents({
    supplierPriceCents: supplierPrice,
    affiliateCommissionCents: affiliateCommission,
    supplierFeeCents,
  })

  return {
    usesAffisellAutoBuy,
    supplierFeeBps,
    supplierFeeCents,
    supplierNetPayoutCents,
    wholesaleForFeeCents: wholesaleForFee,
  }
}

export type BuildPhase1FeesForLineInput = {
  usesAffisellAutoBuy: boolean
  supplier: SupplierFeeUserOverrides
  supplierPriceCents: number
  aeWholesaleCents?: number | null
  affiliateCommissionCents: number
  affiliateMarginRetainedCents: number
  affiliatePlatformFeeBps?: number | null
}

/** Phase-1 fees after resolving catalog vs auto-buy channel. */
export function buildPhase1FeesForOrderLine(input: BuildPhase1FeesForLineInput) {
  const supplierFeeBps = resolveSupplierFeeBpsForOrder({
    usesAffisellAutoBuy: input.usesAffisellAutoBuy,
    supplier: input.supplier,
  })
  const wholesaleForFees = wholesaleCentsForSupplierPlatformFee({
    usesAffisellAutoBuy: input.usesAffisellAutoBuy,
    supplierPriceCents: input.supplierPriceCents,
    aeWholesaleCents: input.aeWholesaleCents,
  })
  const fees = computePhase1OrderFees({
    wholesaleTotalCents: wholesaleForFees,
    affiliateCommissionCents: input.affiliateCommissionCents,
    affiliateMarginRetainedCents: input.affiliateMarginRetainedCents,
    supplierFeeBps,
    affiliatePlatformFeeBps: input.affiliatePlatformFeeBps,
  })
  return {
    ...fees,
    usesAffisellAutoBuy: input.usesAffisellAutoBuy,
    supplierFeeBps,
    wholesaleForFeesCents: wholesaleForFees,
  }
}
