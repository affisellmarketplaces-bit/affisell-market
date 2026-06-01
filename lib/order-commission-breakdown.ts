import { grossAffiliateEarningsCents } from "@/lib/marketplace-phase1-fees"
import {
  resolveOrderSupplierSettlement,
  type SupplierFeeUserOverrides,
} from "@/lib/marketplace-supplier-fee"
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
  affiliateFeeCents?: number | null
  supplierFeeCents?: number | null
  usesAffisellAutoBuy?: boolean | null
  aeWholesaleCents?: number | null
  supplierCommissionRateBps?: number | null
  supplier?: SupplierFeeUserOverrides
  affisellFeeCents: number
  supplierPayoutCents?: number | null
  marginCents: number
}): OrderCommissionBreakdown {
  const supplierGross = Math.max(0, order.supplierPriceCents ?? order.basePriceCents)
  const clientHt = affisellFeeBaseCentsFromOrder(order)
  const tax = Math.max(0, order.taxCents ?? 0)
  const clientTtc =
    order.totalCents != null && order.totalCents > 0 ? order.totalCents : clientHt + tax
  const affiliateCommission = Math.max(0, order.affiliatePayoutCents)
  const supplierSettlement = resolveOrderSupplierSettlement({
    usesAffisellAutoBuy: order.usesAffisellAutoBuy,
    supplier: order.supplier ?? {},
    supplierPriceCents: supplierGross,
    basePriceCents: order.basePriceCents,
    affiliatePayoutCents: affiliateCommission,
    aeWholesaleCents: order.aeWholesaleCents,
    supplierFeeCents: order.supplierFeeCents,
    supplierPayoutCents: order.supplierPayoutCents,
    supplierCommissionRateBps: order.supplierCommissionRateBps,
  })
  const supplierPlatformFee = supplierSettlement.supplierFeeCents
  const supplierNet = supplierSettlement.supplierNetPayoutCents
  const feeModeLabel = supplierSettlement.usesAffisellAutoBuy ? "auto-buy" : "catalogue"
  const affiliateMarkup = Math.max(0, order.affiliateMarginRetainedCents)
  const affiliatePlatformFee = Math.max(0, order.affiliateFeeCents ?? 0)
  const affiliateGross = grossAffiliateEarningsCents(affiliateCommission, affiliateMarkup)
  const affiliateNet = Math.max(0, affiliateGross - affiliatePlatformFee)
  const affisellFee = Math.max(0, order.affisellFeeCents)

  return {
    clientHtCents: clientHt,
    clientTtcCents: clientTtc,
    affiliateTotalCents: affiliateNet,
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
        label: "Frais plateforme Affisell (fournisseur)",
        amountCents: supplierPlatformFee,
        hint: `% du wholesale (${feeModeLabel} · ${supplierSettlement.supplierFeeBps / 100} %)`,
      },
      {
        label: "Markup affilié",
        amountCents: affiliateMarkup,
        hint: "Marge commerciale sur votre prix boutique",
      },
      {
        label: "Frais plateforme Affisell (affilié)",
        amountCents: affiliatePlatformFee,
        hint: "% de vos gains (commission + markup)",
      },
      {
        label: "Frais plateforme Affisell (total commande)",
        amountCents: affisellFee,
        hint: "Part fournisseur + part affilié (reporting ops)",
      },
      { label: "Net fournisseur", amountCents: supplierNet },
      {
        label: "Gain affilié net",
        amountCents: affiliateNet,
        hint:
          affiliatePlatformFee > 0
            ? `Brut ${formatStoreCurrencyFromCents(affiliateGross)} − fee affilié`
            : undefined,
      },
    ],
  }
}

export function formatBreakdownAmount(cents: number): string {
  return formatStoreCurrencyFromCents(cents)
}
