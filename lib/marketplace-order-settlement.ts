import {
  DEFAULT_AFFISELL_COMMISSION_BPS,
  affisellFeeCentsFromLine,
} from "@/lib/affisell-platform-commission"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import {
  resolveOrderSupplierSettlement,
  type ResolveOrderSupplierSettlementInput,
} from "@/lib/marketplace-supplier-fee"

/** @deprecated Use per-category `affisellCommissionRateBps` — kept for docs/tests (10%). */
export const AFFISELL_MARKETPLACE_FEE_PERCENT = DEFAULT_AFFISELL_COMMISSION_BPS / 100

export type MarketplaceOrderSettlement = {
  /** Client line HT (supplier wholesale + affiliate commercial uplift, ex-VAT). */
  sellingPriceCents: number
  /** Supplier catalog wholesale (HT) for the line. */
  basePriceCents: number
  marginCents: number
  /** HT base used for Affisell fee (= client line HT before tax). */
  affisellFeeBaseCents: number
  /** Affisell platform fee (% of `affisellFeeBaseCents`, never on VAT). */
  affisellFeeCents: number
  /** Affiliate-side platform fee (% of commission + markup). */
  affiliatePlatformFeeCents?: number
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
  /**
   * HT line total for Affisell fee (catalog + affiliate uplift, ex-VAT).
   * Defaults to `sellingPriceCents` when checkout lines are tax-exclusive.
   */
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
 * - Supplier net (before platform fee) = wholesale − partner commission; Phase 1 fee applied at payout.
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

  const affisellFeeBaseCents = Math.max(
    0,
    Math.round(input.affisellFeeBaseCents ?? sellingPriceCents)
  )
  const affisellFeeCents = affisellFeeCentsFromLine(
    affisellFeeBaseCents,
    input.affisellCommissionRateBps ?? DEFAULT_AFFISELL_COMMISSION_BPS
  )

  const marginCents = Math.max(0, sellingPriceCents - supplierPriceCents)

  const affiliateMarginRetainedCents =
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
    affisellFeeBaseCents,
    affisellFeeCents,
    affiliateCommissionCents,
    affiliateMarginRetainedCents,
    supplierNetCents,
  }
}

/** Re-run affiliate markup after HT subtotal / Affisell fee is known (post–Stripe Tax sync). */
export function recomputeAffiliateMarginRetainedCents(args: {
  clientLineHtCents: number
  supplierPriceCents: number
  affisellFeeCents: number
  affiliateCommissionCents: number
  fixedListingMarginCents?: number
}): number {
  if (args.fixedListingMarginCents != null && args.fixedListingMarginCents > 0) {
    return Math.max(0, Math.round(args.fixedListingMarginCents))
  }
  return Math.max(
    0,
    Math.round(args.clientLineHtCents) -
      Math.round(args.supplierPriceCents) -
      Math.round(args.affisellFeeCents) -
      Math.round(args.affiliateCommissionCents)
  )
}

/** Recompute supplier Connect payout (catalog vs auto-buy fee, legacy rows included). */
export function resolveSupplierPayoutCentsFromOrder(
  order: ResolveOrderSupplierSettlementInput
): number {
  const settlement = resolveOrderSupplierSettlement({
    ...order,
    supplier: order.supplier ?? {},
  })
  const hasFrozenMode =
    order.usesAffisellAutoBuy === true || order.usesAffisellAutoBuy === false
  const stored = order.supplierPayoutCents
  if (hasFrozenMode && stored != null && stored > 0) {
    return Math.round(stored)
  }
  return settlement.supplierNetPayoutCents
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

/** Supplier inbox: net wholesale after partner + Affisell platform fee. */
export function formatSupplierNewOrderNotification(args: {
  productName: string
  variantBit: string
  qty: number
  customerEmail: string
  partnerListingCode?: string | null
  supplierNetCents: number
  supplierGrossCents?: number
  affiliateCommissionCents?: number
  supplierPlatformFeeCents?: number
  usesAffisellAutoBuy?: boolean
}): string {
  const variant = args.variantBit ? args.variantBit : ""
  const ref =
    args.partnerListingCode?.trim() ? ` · Partner listing ${args.partnerListingCode.trim()}` : ""
  const gross = args.supplierGrossCents
  const commission = args.affiliateCommissionCents
  const platformFee = Math.max(0, Math.round(args.supplierPlatformFeeCents ?? 0))
  const channel =
    args.usesAffisellAutoBuy === true
      ? "auto-buy"
      : args.usesAffisellAutoBuy === false
        ? "catalogue"
        : null
  const netLine =
    gross != null && gross > args.supplierNetCents
      ? [
          `Net wholesale ${money(args.supplierNetCents)} (catalog ${money(gross)}`,
          commission != null && commission > 0 ? `− partner ${money(commission)}` : null,
          platformFee > 0
            ? `− Affisell ${money(platformFee)}${channel ? ` · ${channel}` : ""}`
            : null,
          ")",
        ]
          .filter(Boolean)
          .join(" ")
      : `Your net wholesale (COGS): ${money(args.supplierNetCents)}`

  return [
    `New order to ship · ${args.productName}${variant} ×${args.qty} · ${args.customerEmail}${ref}`,
    netLine,
  ].join(" · ")
}

/** Align notification amounts with persisted order row (Phase 1 fees / markup). */
export function affiliateSaleNotificationSettlement(
  settlement: MarketplaceOrderSettlement,
  orderAmounts: {
    affiliateMarginRetainedCents: number
    affiliatePlatformFeeCents: number
  }
): MarketplaceOrderSettlement {
  return {
    ...settlement,
    affiliateMarginRetainedCents: Math.max(
      0,
      Math.round(orderAmounts.affiliateMarginRetainedCents)
    ),
    affiliatePlatformFeeCents: Math.max(0, Math.round(orderAmounts.affiliatePlatformFeeCents)),
  }
}

/** Affiliate inbox: sale on their storefront with earnings breakdown. */
export function formatAffiliateNewSaleNotification(args: {
  productName: string
  variantBit: string
  qty: number
  settlement: MarketplaceOrderSettlement
  taxCents?: number | null
  totalCents?: number | null
}): string {
  const { settlement: s } = args
  const variant = args.variantBit ? args.variantBit : ""
  const grossEarnings = s.affiliateCommissionCents + s.affiliateMarginRetainedCents
  const affiliateFee = Math.max(0, Math.round(s.affiliatePlatformFeeCents ?? 0))
  const netEarnings = Math.max(0, grossEarnings - affiliateFee)
  const ht = s.affisellFeeBaseCents
  const tax = Math.max(0, Math.round(args.taxCents ?? 0))
  const ttc =
    args.totalCents != null && args.totalCents > 0
      ? Math.round(args.totalCents)
      : tax > 0
        ? ht + tax
        : ht
  const clientLine =
    tax > 0 && ttc > ht
      ? `Client ${money(ttc)} (HT ${money(ht)} + VAT ${money(tax)})`
      : `Line HT ${money(ht)}`
  const feeLine =
    affiliateFee > 0
      ? `Affisell fee ${money(affiliateFee)} (${money(grossEarnings)} earnings base)`
      : null
  return [
    `Sale on your store · ${args.productName}${variant} ×${args.qty}`,
    clientLine,
    `Your earnings ${money(netEarnings)} (commission ${money(s.affiliateCommissionCents)} + markup ${money(s.affiliateMarginRetainedCents)}${affiliateFee > 0 ? ` − fee ${money(affiliateFee)}` : ""})`,
    feeLine,
  ]
    .filter(Boolean)
    .join(" · ")
}
