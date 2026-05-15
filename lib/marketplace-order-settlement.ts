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

function money(cents: number): string {
  return formatStoreCurrencyFromCents(cents)
}

/** Supplier inbox: total sale + fee breakdown (auto-created on affiliate storefront checkout). */
export function formatSupplierNewOrderNotification(args: {
  productName: string
  variantBit: string
  qty: number
  customerEmail: string
  storeName?: string | null
  settlement: MarketplaceOrderSettlement
}): string {
  const { settlement: s } = args
  const variant = args.variantBit ? args.variantBit : ""
  const via = args.storeName ? ` · via ${args.storeName}` : ""
  const lines = [
    `New order to ship · ${args.productName}${variant} ×${args.qty} · ${args.customerEmail}${via}`,
    `Sale total ${money(s.sellingPriceCents)}`,
    `− Affisell marketplace (${AFFISELL_MARKETPLACE_FEE_PERCENT}%): ${money(s.affisellFeeCents)}`,
    `− Partner commission (your offer): ${money(s.affiliateCommissionCents)}`,
  ]
  lines.push(`Your wholesale (COGS): ${money(s.supplierNetCents)}`)
  return lines.join(" · ")
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
