import { grossAffiliateEarningsCents } from "@/lib/marketplace-phase1-fees"
import {
  resolveOrderSupplierSettlement,
  type SupplierFeeUserOverrides,
} from "@/lib/marketplace-supplier-fee"
import { affisellFeeBaseCentsFromOrder } from "@/lib/marketplace-order-settlement"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { OrderAccessRole } from "@/lib/order-access"

export type OrderCommissionRowKey =
  | "client_ht"
  | "client_tax"
  | "client_ttc"
  | "supplier_catalog"
  | "partner_commission"
  | "platform_fee_supplier"
  | "affiliate_markup"
  | "platform_fee_affiliate"
  | "platform_fee_total"
  | "supplier_net"
  | "affiliate_net"

export type OrderCommissionRow = {
  key: OrderCommissionRowKey
  label: string
  amountCents: number
  hint?: string
}

export type OrderCommissionBreakdown = {
  rows: OrderCommissionRow[]
  clientHtCents: number
  clientTtcCents: number
  affiliateTotalCents: number
  supplierNetCents: number
  affisellFeeCents: number
}

export type OrderCommissionView = {
  headline: string
  footnote: string
  rows: OrderCommissionRow[]
}

export function isOrderCommissionRowVisible(
  key: OrderCommissionRowKey,
  role: OrderAccessRole,
  showRevenueToAffiliate: boolean
): boolean {
  switch (key) {
    case "client_ht":
    case "client_tax":
    case "client_ttc":
      return role === "AFFILIATE" || role === "CUSTOMER"
    case "supplier_catalog":
    case "supplier_net":
      return role === "SUPPLIER" || (role === "AFFILIATE" && showRevenueToAffiliate)
    case "partner_commission":
      return role === "SUPPLIER" || role === "AFFILIATE"
    case "platform_fee_supplier":
      return role === "SUPPLIER"
    case "affiliate_markup":
    case "affiliate_net":
    case "platform_fee_affiliate":
      return role === "AFFILIATE"
    case "platform_fee_total":
      return false
    default:
      return false
  }
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
      { key: "client_ht", label: "Prix client HT", amountCents: clientHt },
      { key: "client_tax", label: "TVA", amountCents: tax, hint: "Collectée via Stripe Tax" },
      { key: "client_ttc", label: "Prix client TTC", amountCents: clientTtc },
      { key: "supplier_catalog", label: "Catalogue fournisseur (HT)", amountCents: supplierGross },
      {
        key: "partner_commission",
        label: "Commission partenaire",
        amountCents: affiliateCommission,
        hint: "Prélevée sur le wholesale fournisseur",
      },
      {
        key: "platform_fee_supplier",
        label: "Frais plateforme Affisell (fournisseur)",
        amountCents: supplierPlatformFee,
        hint: `% du wholesale (${feeModeLabel} · ${supplierSettlement.supplierFeeBps / 100} %)`,
      },
      {
        key: "affiliate_markup",
        label: "Markup affilié",
        amountCents: affiliateMarkup,
        hint: "Marge commerciale sur votre prix boutique",
      },
      {
        key: "platform_fee_affiliate",
        label: "Frais plateforme Affisell (affilié)",
        amountCents: affiliatePlatformFee,
        hint: "% de vos gains (commission + markup)",
      },
      {
        key: "platform_fee_total",
        label: "Frais plateforme Affisell (total commande)",
        amountCents: affisellFee,
        hint: "Part fournisseur + part affilié (reporting ops)",
      },
      { key: "supplier_net", label: "Net fournisseur", amountCents: supplierNet },
      {
        key: "affiliate_net",
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

export function buildOrderCommissionView(
  role: OrderAccessRole,
  order: Parameters<typeof buildOrderCommissionBreakdown>[0],
  showRevenueToAffiliate = false
): OrderCommissionView {
  const breakdown = buildOrderCommissionBreakdown(order)
  const rows = breakdown.rows.filter((row) =>
    isOrderCommissionRowVisible(row.key, role, showRevenueToAffiliate)
  )

  const headline =
    role === "SUPPLIER"
      ? `Votre versement : ${formatBreakdownAmount(breakdown.supplierNetCents)}`
      : role === "AFFILIATE"
        ? `Vos gains : ${formatBreakdownAmount(breakdown.affiliateTotalCents)}`
        : `Total payé : ${formatBreakdownAmount(breakdown.clientTtcCents)}`

  const footnote =
    role === "CUSTOMER"
      ? "Montants HT sauf mention TTC."
      : role === "SUPPLIER"
        ? "Montants HT · wholesale catalogue et déductions sur votre versement."
        : "Montants HT sauf mention TTC · fee affilié = % de vos gains (commission + markup)"

  return { headline, footnote, rows }
}

export function formatBreakdownAmount(cents: number): string {
  return formatStoreCurrencyFromCents(cents)
}
