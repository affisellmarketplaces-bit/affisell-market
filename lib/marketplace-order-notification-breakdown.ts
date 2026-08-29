import {
  deriveAffiliateCommissionCentsFromOrder,
  deriveAffiliateListingMarginGrossCents,
  deriveAffiliateMarginRetainedCentsFromOrder,
  deriveAffiliateNetTransferCentsFromOrder,
  estimateAffiliatePlatformFeeCents,
} from "@/lib/marketplace-order-partner-amounts"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { affiliateNotificationSettlementFromOrder } from "@/lib/marketplace-order-notification-heal"
import type { AffiliateSaleOrderAmounts } from "@/lib/marketplace-order-notification-types"
import { grossAffiliateEarningsCents } from "@/lib/marketplace-phase1-fees"
import type { MerchantNotificationBreakdown } from "@/lib/merchant-notification-display"

export type OrderForAffiliateSaleBreakdown = AffiliateSaleOrderAmounts

/** Structured ledger rows for affiliate NEW_SALE alerts (server + client-safe display). */
export function buildAffiliateSaleNotificationBreakdown(
  order: OrderForAffiliateSaleBreakdown
): MerchantNotificationBreakdown {
  const commissionCents = deriveAffiliateCommissionCentsFromOrder(order)
  const listingMarginGross = deriveAffiliateListingMarginGrossCents(order)
  const markupCents = deriveAffiliateMarginRetainedCentsFromOrder(order, commissionCents)
  const feeCents =
    Math.max(0, Math.round(order.affiliateFeeCents ?? 0)) ||
    estimateAffiliatePlatformFeeCents({
      commissionCents,
      markupGrossCents: listingMarginGross || markupCents,
    })
  const markupForGross = listingMarginGross > 0 ? listingMarginGross : markupCents
  const grossCents = grossAffiliateEarningsCents(commissionCents, markupForGross)
  const netCents = Math.max(0, grossCents - feeCents)

  const settlement = affiliateNotificationSettlementFromOrder({
    ...order,
    affiliatePayoutCents:
      order.affiliatePayoutCents > 0 ? order.affiliatePayoutCents : commissionCents,
    commissionCents: order.commissionCents > 0 ? order.commissionCents : commissionCents,
    affiliateMarginRetainedCents:
      (order.affiliateMarginRetainedCents ?? 0) > 0
        ? order.affiliateMarginRetainedCents
        : markupCents,
    affiliateFeeCents: feeCents,
  })

  const htCents = settlement.affisellFeeBaseCents
  const taxCents = Math.max(0, Math.round(order.taxCents ?? 0))
  const totalCents = Math.max(0, Math.round(order.totalCents ?? 0))

  const breakdown: MerchantNotificationBreakdown = {
    netEarnings: formatStoreCurrencyFromCents(netCents),
    commission: formatStoreCurrencyFromCents(commissionCents),
    markup: formatStoreCurrencyFromCents(markupForGross),
  }

  if (feeCents > 0) {
    breakdown.affisellFee = formatStoreCurrencyFromCents(feeCents)
    breakdown.earningsBase = formatStoreCurrencyFromCents(grossCents)
  }

  if (taxCents > 0 && totalCents > htCents) {
    breakdown.clientTotal = formatStoreCurrencyFromCents(totalCents)
    breakdown.clientHt = formatStoreCurrencyFromCents(htCents)
    breakdown.clientVat = formatStoreCurrencyFromCents(taxCents)
  } else if (htCents > 0) {
    breakdown.lineHt = formatStoreCurrencyFromCents(htCents)
  }

  return breakdown
}

function parseMoneyCents(token: string | undefined): number {
  if (!token?.trim()) return 0
  const digits = token.replace(/[^\d,.-]/g, "").replace(",", ".")
  const value = Number.parseFloat(digits)
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}

/** Prefer order-row breakdown when persisted message shows zero earnings but order has net > 0. */
export function resolveAffiliateSaleNotificationBreakdown(args: {
  parsed?: MerchantNotificationBreakdown
  order: OrderForAffiliateSaleBreakdown
}): MerchantNotificationBreakdown {
  const fromOrder = buildAffiliateSaleNotificationBreakdown(args.order)
  const parsedNet = parseMoneyCents(args.parsed?.netEarnings)
  const orderNet = parseMoneyCents(fromOrder.netEarnings)

  if (orderNet > 0 && (parsedNet === 0 || parsedNet !== orderNet)) {
    return fromOrder
  }

  if (args.parsed && Object.values(args.parsed).some(Boolean)) {
    return args.parsed
  }

  return fromOrder
}
