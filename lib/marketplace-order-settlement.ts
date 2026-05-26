import {
  DEFAULT_AFFISELL_COMMISSION_BPS,
  affisellFeeCentsFromLine,
} from "@/lib/affisell-platform-commission"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

/** @deprecated Use per-category `affisellCommissionRateBps` — kept for docs/tests (10%). */
export const AFFISELL_MARKETPLACE_FEE_PERCENT = DEFAULT_AFFISELL_COMMISSION_BPS / 100

export type MarketplaceOrderSettlement = {
  sellingPriceCents: number
  /** Supplier catalog wholesale (HT) for the line. */
  basePriceCents: number
  marginCents: number
  /** Affisell platform fee (HT base, ex-VAT when `affisellFeeBaseCents` provided). */
  affisellFeeCents: number
  /** Commission paid from supplier wholesale to affiliate (`supplierPrice × bps`). */
  affiliateCommissionCents: number
  /** Affiliate markup above wholesale (listing margin). */
  affiliateMarginRetainedCents: number
  /** Net wholesale credited to supplier after affiliate commission offer. */
  supplierNetCents: number
}

export type ComputeMarketplaceOrderSettlementInput = {
  sellingPriceCents: number
  supplierPriceCents: number
  /** Supplier → affiliate commission in bps (1100 = 11% of supplier wholesale). */
  supplierCommissionRateBps: number
  affiliateMarginCents?: number
  affisellCommissionRateBps?: number
  /** HT amount for Affisell fee (ex-VAT). Defaults to `sellingPriceCents`. */
  affisellFeeBaseCents?: number
}

/** @deprecated Prefer `supplierPriceCents` + `supplierCommissionRateBps`. */
export type LegacyMarketplaceOrderSettlementInput = {
  sellingPriceCents: number
  basePriceCents: number
  supplierCommissionRatePercent: number
  affiliateMarginCents?: number
  affisellCommissionRateBps?: number
  affisellFeeBaseCents?: number
}

function normalizeSettlementInput(
  args: ComputeMarketplaceOrderSettlementInput | LegacyMarketplaceOrderSettlementInput
): ComputeMarketplaceOrderSettlementInput {
  if ("supplierCommissionRateBps" in args && args.supplierCommissionRateBps != null) {
    return args as ComputeMarketplaceOrderSettlementInput
  }
  const legacy = args as LegacyMarketplaceOrderSettlementInput
  return {
    sellingPriceCents: legacy.sellingPriceCents,
    supplierPriceCents: legacy.basePriceCents,
    supplierCommissionRateBps: Math.round(legacy.supplierCommissionRatePercent * 100),
    affiliateMarginCents: legacy.affiliateMarginCents,
    affisellCommissionRateBps: legacy.affisellCommissionRateBps,
    affisellFeeBaseCents: legacy.affisellFeeBaseCents,
  }
}

/**
 * Marketplace settlement:
 * - Affiliate commission = % of supplier wholesale (commission offered on catalog).
 * - Supplier net = wholesale − that commission (Affisell fee stays on platform, HT base).
 */
export function computeMarketplaceOrderSettlement(
  args: ComputeMarketplaceOrderSettlementInput | LegacyMarketplaceOrderSettlementInput
): MarketplaceOrderSettlement {
  const input = normalizeSettlementInput(args)
  const sellingPriceCents = Math.max(0, Math.round(input.sellingPriceCents))
  const supplierPriceCents = Math.max(0, Math.round(input.supplierPriceCents))
  const bps = Math.max(0, Math.round(input.supplierCommissionRateBps))

  const affiliateCommissionCents = Math.round((supplierPriceCents * bps) / 10_000)
  const supplierNetCents = Math.max(0, supplierPriceCents - affiliateCommissionCents)

  const feeBase = Math.max(
    0,
    Math.round(input.affisellFeeBaseCents ?? sellingPriceCents)
  )
  const affisellFeeCents = affisellFeeCentsFromLine(
    feeBase,
    input.affisellCommissionRateBps ?? DEFAULT_AFFISELL_COMMISSION_BPS
  )

  const marginCents = Math.max(0, sellingPriceCents - supplierPriceCents)

  let affiliateMarginRetainedCents =
    input.affiliateMarginCents != null
      ? Math.max(0, Math.round(input.affiliateMarginCents))
      : Math.max(
          0,
          sellingPriceCents - supplierPriceCents - affisellFeeCents - affiliateCommissionCents
        )

  return {
    sellingPriceCents,
    basePriceCents: supplierPriceCents,
    marginCents,
    affisellFeeCents,
    affiliateCommissionCents,
    affiliateMarginRetainedCents,
    supplierNetCents,
  }
}

/** Recompute supplier Connect payout from persisted order fields (legacy rows included). */
export function resolveSupplierPayoutCentsFromOrder(order: {
  supplierPayoutCents?: number | null
  supplierPriceCents?: number | null
  basePriceCents: number
  supplierCommissionRateBps?: number | null
  affiliatePayoutCents?: number | null
}): number {
  const stored = order.supplierPayoutCents
  if (stored != null && stored > 0) return Math.round(stored)

  const supplierPrice = Math.max(
    0,
    Math.round(order.supplierPriceCents ?? order.basePriceCents)
  )
  const bps = Math.max(0, Math.round(order.supplierCommissionRateBps ?? 0))
  if (bps > 0) {
    return Math.max(0, supplierPrice - Math.round((supplierPrice * bps) / 10_000))
  }

  const commission = Math.max(0, Math.round(order.affiliatePayoutCents ?? 0))
  return Math.max(0, supplierPrice - commission)
}

/** HT base for Affisell fee when order row has VAT breakdown. */
export function affisellFeeBaseCentsFromOrder(order: {
  subtotalCents?: number | null
  sellingPriceCents: number
  taxCents?: number | null
}): number {
  if (order.subtotalCents != null && order.subtotalCents > 0) {
    return Math.round(order.subtotalCents)
  }
  const tax = Math.max(0, Math.round(order.taxCents ?? 0))
  const selling = Math.max(0, Math.round(order.sellingPriceCents))
  return Math.max(0, selling - tax)
}

/** Three-way Connect split: Supplier + Affiliate + Affisell (HT + platform fee). */
export function calculateThreeWaySplit(input: {
  supplierPriceCents: number
  supplierCommissionRateBps: number
  affiliateMarginCents: number
  affisellCommissionRateBps: number
  stripeFeeCents: number
}) {
  const priceClientCents = input.supplierPriceCents + input.affiliateMarginCents
  const affisellFeeCents = Math.round(priceClientCents * input.affisellCommissionRateBps / 10_000)
  const totalClientCents = priceClientCents + affisellFeeCents
  const supplierCommissionToAffiliateCents = Math.round(
    input.supplierPriceCents * input.supplierCommissionRateBps / 10_000
  )
  const supplierPayoutCents = input.supplierPriceCents - supplierCommissionToAffiliateCents
  const affiliatePayoutCents = supplierCommissionToAffiliateCents + input.affiliateMarginCents
  return {
    totalClientCents,
    priceClientCents,
    affisellFeeCents,
    supplierPayoutCents,
    affiliatePayoutCents,
    supplierCommissionToAffiliateCents,
    stripeFeeCents: input.stripeFeeCents,
    affisellNetCents: affisellFeeCents - input.stripeFeeCents,
  }
}

function money(cents: number): string {
  return formatStoreCurrencyFromCents(cents)
}

/** Supplier inbox: net wholesale (after partner commission) + opaque partner ref. */
export function formatSupplierNewOrderNotification(args: {
  productName: string
  variantBit: string
  qty: number
  customerEmail: string
  partnerListingCode?: string | null
  supplierNetCents: number
  supplierGrossCents?: number
  affiliateCommissionCents?: number
}): string {
  const variant = args.variantBit ? args.variantBit : ""
  const ref =
    args.partnerListingCode?.trim() ? ` · Partner listing ${args.partnerListingCode.trim()}` : ""
  const gross = args.supplierGrossCents
  const commission = args.affiliateCommissionCents
  const netLine =
    gross != null &&
    commission != null &&
    commission > 0 &&
    gross > args.supplierNetCents
      ? ` · Net wholesale ${money(args.supplierNetCents)} (catalog ${money(gross)} − partner ${money(commission)})`
      : ` · Your net wholesale (COGS): ${money(args.supplierNetCents)}`

  return [
    `New order to ship · ${args.productName}${variant} ×${args.qty} · ${args.customerEmail}${ref}`,
    netLine.replace(/^ · /, ""),
  ].join(" · ")
}

/** Affiliate inbox: sale on their storefront with earnings breakdown. */
export function formatAffiliateNewSaleNotification(args: {
  productName: string
  variantBit: string
  qty: number
  settlement: MarketplaceOrderSettlement
}): string {
  const { settlement: s } = args
  const variant = args.variantBit ? args.variantBit : ""
  const affiliateTotal = s.affiliateCommissionCents + s.affiliateMarginRetainedCents
  return [
    `Sale on your store · ${args.productName}${variant} ×${args.qty}`,
    `Line total ${money(s.sellingPriceCents)}`,
    `Your earnings ${money(affiliateTotal)} (commission ${money(s.affiliateCommissionCents)} + markup ${money(s.affiliateMarginRetainedCents)})`,
    `Affisell fee ${money(s.affisellFeeCents)} (HT base)`,
  ].join(" · ")
}
