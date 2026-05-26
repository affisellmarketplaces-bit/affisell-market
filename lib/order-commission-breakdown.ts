import { affisellFeeBaseCentsFromOrder } from "@/lib/marketplace-order-settlement"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

export type OrderCommissionRow = {
  label: string
  amountCents: number
  hint?: string
  hidden?: boolean
}

export type OrderCommissionBreakdown = {
  rows: OrderCommissionRow[]
  clientHtCents: number
  clientTtcCents: number
  affiliateTotalCents: number
  supplierNetCents: number
  affisellFeeCents: number
}

export function buildOrderCommissionBreakdown(order: {
  basePriceCents: number
  supplierPriceCents?: number | null
  sellingPriceCents: number
  subtotalCents?: number | null
  taxCents?: number | null
  totalCents?: number | null
  affiliatePayoutCents: number
  affiliateMarginRetainedCents: number
  affisellFeeCents: number
  supplierPayoutCents?: number | null
  marginCents: number
}): OrderCommissionBreakdown {
  const supplierGross = Math.max(0, order.supplierPriceCents ?? order.basePriceCents)
  const clientHt = affisellFeeBaseCentsFromOrder(order)
  const tax = Math.max(0, order.taxCents ?? 0)
  const clientTtc =
    order.totalCents != null && order.totalCents > 0 ? order.totalCents : clientHt + tax
  const supplierNet = Math.max(0, order.supplierPayoutCents ?? supplierGross - order.affiliatePayoutCents)
  const affiliateCommission = Math.max(0, order.affiliatePayoutCents)
  const affiliateMarkup = Math.max(0, order.affiliateMarginRetainedCents)
  const affisellFee = Math.max(0, order.affisellFeeCents)

  return {
    clientHtCents: clientHt,
    clientTtcCents: clientTtc,
    affiliateTotalCents: affiliateCommission + affiliateMarkup,
    supplierNetCents: supplierNet,
    affisellFeeCents: affisellFee,
    rows: [
      { label: "Prix client HT", amountCents: clientHt },
      { label: "TVA", amountCents: tax, hint: "Collectée via Stripe Tax" },
      { label: "Prix client TTC", amountCents: clientTtc },
      { label: "Catalogue fournisseur (HT)", amountCents: supplierGross },
      {
        label: "Commission partenaire",
        amountCents: affiliateCommission,
        hint: "Prélevée sur le wholesale fournisseur",
      },
      {
        label: "Markup affilié (net)",
        amountCents: affiliateMarkup,
        hint: "Après frais plateforme sur la ligne HT",
      },
      {
        label: "Frais plateforme Affisell",
        amountCents: affisellFee,
        hint: "% du HT client — non déduit du net fournisseur",
      },
      { label: "Net fournisseur", amountCents: supplierNet },
      {
        label: "Gain affilié total",
        amountCents: affiliateCommission + affiliateMarkup,
      },
    ],
  }
}

export function formatBreakdownAmount(cents: number): string {
  return formatStoreCurrencyFromCents(cents)
}
