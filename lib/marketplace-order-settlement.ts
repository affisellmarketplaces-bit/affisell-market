import { formatStoreCurrencyFromCents } from "@/lib/market-config"

/** Affisell marketplace fee on each storefront sale (percent of line total paid). */
export const AFFISELL_MARKETPLACE_FEE_PERCENT = 10

export type MarketplaceOrderSettlement = {
  sellingPriceCents: number
  basePriceCents: number
  marginCents: number
  /** 10% of `sellingPriceCents` (Affisell platform). */
  affisellFeeCents: number
  /** % of margin offered by supplier (`commissionRate` on product). */
  affiliateCommissionCents: number
  /** Markup retained by affiliate above supplier commission offer. */
  affiliateMarginRetainedCents: number
  /** Supplier wholesale / COGS for the line. */
  supplierNetCents: number
}

export function computeMarketplaceOrderSettlement(args: {
  sellingPriceCents: number
  basePriceCents: number
  supplierCommissionRatePercent: number
}): MarketplaceOrderSettlement {
  const sellingPriceCents = Math.max(0, Math.round(args.sellingPriceCents))
  const basePriceCents = Math.max(0, Math.round(args.basePriceCents))
  const marginCents = Math.max(0, sellingPriceCents - basePriceCents)
  const affisellFeeCents = Math.floor(
    (sellingPriceCents * AFFISELL_MARKETPLACE_FEE_PERCENT) / 100
  )
  const rate = Math.min(100, Math.max(0, Math.round(args.supplierCommissionRatePercent)))
  const affiliateCommissionCents = Math.floor((marginCents * rate) / 100)
  const affiliateMarginRetainedCents = Math.max(0, marginCents - affiliateCommissionCents)
  const supplierNetCents = basePriceCents

  return {
    sellingPriceCents,
    basePriceCents,
    marginCents,
    affisellFeeCents,
    affiliateCommissionCents,
    affiliateMarginRetainedCents,
    supplierNetCents,
  }
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

/** Supplier inbox: wholesale only + opaque partner ref — never retail, margin, or store display name. */
export function formatSupplierNewOrderNotification(args: {
  productName: string
  variantBit: string
  qty: number
  customerEmail: string
  partnerListingCode?: string | null
  supplierNetCents: number
}): string {
  const variant = args.variantBit ? args.variantBit : ""
  const ref =
    args.partnerListingCode?.trim() ? ` · Partner listing ${args.partnerListingCode.trim()}` : ""
  return [
    `New order to ship · ${args.productName}${variant} ×${args.qty} · ${args.customerEmail}${ref}`,
    `Your wholesale (COGS): ${money(args.supplierNetCents)}`,
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
    `Affisell fee ${money(s.affisellFeeCents)} deducted from sale`,
  ].join(" · ")
}
