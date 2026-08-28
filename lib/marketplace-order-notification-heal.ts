import type { Prisma } from "@prisma/client"

import { createMarketplaceOrderNotifications } from "@/lib/marketplace-order-notifications"
import {
  affiliateSaleNotificationSettlement,
  type MarketplaceOrderSettlement,
} from "@/lib/marketplace-order-settlement"
import { resolveOrderAffiliateCommissionCents } from "@/lib/marketplace-phase1-fees"
import type { AffiliateSaleOrderAmounts } from "@/lib/marketplace-order-notification-types"
import { prisma } from "@/lib/prisma"

const PARTNER_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000
const HEAL_BATCH_SIZE = 30
const HEAL_MAX_PASSES = 3
const STALE_REFRESH_BATCH_SIZE = 12

/** Orders that should have a marketplace inbox alert once checkout is paid. */
const HEALABLE_ORDER_STATUSES = ["paid", "preparing", "shipped"] as const

const orderForHealSelect = {
  id: true,
  status: true,
  supplierId: true,
  affiliateId: true,
  quantity: true,
  customerEmail: true,
  variantLabel: true,
  variantImageUrl: true,
  subtotalCents: true,
  sellingPriceCents: true,
  taxCents: true,
  totalCents: true,
  supplierPriceCents: true,
  basePriceCents: true,
  supplierPayoutCents: true,
  supplierFeeCents: true,
  commissionCents: true,
  affiliatePayoutCents: true,
  affiliateMarginRetainedCents: true,
  affiliateFeeCents: true,
  affisellFeeCents: true,
  marginCents: true,
  affiliateMarginCents: true,
  usesAffisellAutoBuy: true,
  paidAt: true,
  merchantSupplierInboxNotifiedAt: true,
  merchantAffiliateInboxNotifiedAt: true,
  product: { select: { name: true } },
  affiliate: { select: { store: { select: { partnerListingCode: true } } } },
  affiliateProduct: {
    select: {
      affiliate: { select: { store: { select: { partnerListingCode: true } } } },
    },
  },
} satisfies Prisma.OrderSelect

type OrderForHeal = Prisma.OrderGetPayload<{ select: typeof orderForHealSelect }>

export type HealMarketplaceOrderNotificationsResult = {
  supplierInboxCreated: boolean
  affiliateInboxCreated: boolean
  supplierInboxRefreshed: boolean
  affiliateInboxRefreshed: boolean
}

function resolvePartnerListingCodeForHeal(order: OrderForHeal): string | null {
  const fromListing = order.affiliateProduct?.affiliate?.store?.partnerListingCode?.trim()
  if (fromListing) return fromListing
  return order.affiliate?.store?.partnerListingCode?.trim() || null
}

/** Build affiliate settlement for inbox copy from persisted order row (source of truth). */
export function affiliateNotificationSettlementFromOrder(
  order: AffiliateSaleOrderAmounts
): MarketplaceOrderSettlement {
  const lineHtCents =
    order.subtotalCents ?? order.sellingPriceCents ?? order.totalCents ?? 0
  const supplierPriceCents = Math.max(
    0,
    Math.round(order.supplierPriceCents ?? order.basePriceCents ?? 0)
  )
  const commissionCents = resolveOrderAffiliateCommissionCents({
    commissionCents: order.commissionCents,
    affiliatePayoutCents: order.affiliatePayoutCents,
  })
  const marginRetainedCents = Math.max(0, Math.round(order.affiliateMarginRetainedCents ?? 0))
  const affiliateFeeCents = Math.max(0, Math.round(order.affiliateFeeCents ?? 0))

  return affiliateSaleNotificationSettlement(
    {
      sellingPriceCents: lineHtCents,
      basePriceCents: supplierPriceCents,
      marginCents: Math.max(0, Math.round(order.marginCents ?? 0)),
      affisellFeeBaseCents: lineHtCents,
      affisellFeeCents: Math.max(0, Math.round(order.affisellFeeCents ?? 0)),
      affiliateCommissionCents: commissionCents,
      affiliateMarginRetainedCents: marginRetainedCents,
      supplierNetCents: Math.max(0, Math.round(order.supplierPayoutCents ?? 0)),
      affiliatePlatformFeeCents: affiliateFeeCents,
    },
    {
      affiliateCommissionCents: commissionCents,
      affiliateMarginRetainedCents: marginRetainedCents,
      affiliatePlatformFeeCents: affiliateFeeCents,
    }
  )
}

export function buildMarketplaceOrderNotificationArgs(order: OrderForHeal) {
  const settlement = affiliateNotificationSettlementFromOrder(order)
  const variantBit = order.variantLabel?.trim() ? ` · ${order.variantLabel.trim()}` : ""

  return {
    orderId: order.id,
    supplierId: order.supplierId,
    affiliateId: order.affiliateId,
    productName: order.product.name,
    variantBit,
    qty: Math.max(1, order.quantity),
    customerEmail: order.customerEmail,
    partnerListingCode: resolvePartnerListingCodeForHeal(order),
    settlement,
    supplierNetCents: order.supplierPayoutCents,
    supplierPlatformFeeCents: order.supplierFeeCents,
    usesAffisellAutoBuy: order.usesAffisellAutoBuy,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    imageUrl: order.variantImageUrl,
  }
}

/** Idempotent heal + refresh for one paid marketplace order. */
export async function healMarketplaceOrderNotifications(
  orderId: string
): Promise<HealMarketplaceOrderNotificationsResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: orderForHealSelect,
  })

  if (
    !order ||
    !HEALABLE_ORDER_STATUSES.includes(order.status as (typeof HEALABLE_ORDER_STATUSES)[number])
  ) {
    return {
      supplierInboxCreated: false,
      affiliateInboxCreated: false,
      supplierInboxRefreshed: false,
      affiliateInboxRefreshed: false,
    }
  }

  try {
    const result = await prisma.$transaction((tx) =>
      createMarketplaceOrderNotifications(tx, buildMarketplaceOrderNotificationArgs(order))
    )

    if (
      result.supplierInboxCreated ||
      result.affiliateInboxCreated ||
      result.supplierInboxRefreshed ||
      result.affiliateInboxRefreshed
    ) {
      console.log("[marketplace-order-notification-heal]", {
        orderId,
        ...result,
      })
    }

    return result
  } catch (error) {
    console.error("[marketplace-order-notification-heal]", {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      supplierInboxCreated: false,
      affiliateInboxCreated: false,
      supplierInboxRefreshed: false,
      affiliateInboxRefreshed: false,
    }
  }
}

export type HealPartnerNotificationsResult = {
  scanned: number
  healed: number
  refreshed: number
}

type PartnerScope = { supplierId: string } | { affiliateId: string }

/** Heal recent paid orders missing inbox alerts for one supplier or affiliate dashboard. */
async function healRecentPartnerMarketplaceNotificationsPass(
  scope: PartnerScope
): Promise<HealPartnerNotificationsResult> {
  const partnerWhere =
    "supplierId" in scope ? { supplierId: scope.supplierId } : { affiliateId: scope.affiliateId }
  const inboxType = "supplierId" in scope ? ("NEW_ORDER" as const) : ("NEW_SALE" as const)
  const userId = "supplierId" in scope ? scope.supplierId : scope.affiliateId
  const lookback = new Date(Date.now() - PARTNER_LOOKBACK_MS)

  const existing = await prisma.notification.findMany({
    where: {
      userId,
      type: inboxType,
      orderId: { not: null },
      createdAt: { gte: lookback },
    },
    select: { orderId: true },
    take: 500,
  })
  const covered = new Set(
    existing.map((row) => row.orderId).filter((id): id is string => Boolean(id))
  )

  const missingAlertOrders = await prisma.order.findMany({
    where: {
      ...partnerWhere,
      status: { in: [...HEALABLE_ORDER_STATUSES] },
      createdAt: { gte: lookback },
      ...(covered.size > 0 ? { id: { notIn: [...covered] } } : {}),
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: HEAL_BATCH_SIZE,
  })

  let healed = 0
  let refreshed = 0

  for (const row of missingAlertOrders) {
    const result = await healMarketplaceOrderNotifications(row.id)
    if (
      ("supplierId" in scope && result.supplierInboxCreated) ||
      ("affiliateId" in scope && result.affiliateInboxCreated)
    ) {
      healed += 1
    }
  }

  const notifiedFlag =
    "supplierId" in scope ? "merchantSupplierInboxNotifiedAt" : "merchantAffiliateInboxNotifiedAt"

  const refreshCandidates = await prisma.order.findMany({
    where: {
      ...partnerWhere,
      status: { in: [...HEALABLE_ORDER_STATUSES] },
      createdAt: { gte: lookback },
      [notifiedFlag]: { not: null },
    },
    select: { id: true },
    orderBy: { paidAt: "desc" },
    take: STALE_REFRESH_BATCH_SIZE,
  })

  for (const row of refreshCandidates) {
    const result = await healMarketplaceOrderNotifications(row.id)
    if (
      ("supplierId" in scope && result.supplierInboxRefreshed) ||
      ("affiliateId" in scope && result.affiliateInboxRefreshed)
    ) {
      refreshed += 1
    }
  }

  const scanned = missingAlertOrders.length + refreshCandidates.length
  if (scanned === 0) {
    return { scanned: 0, healed: 0, refreshed: 0 }
  }

  return { scanned, healed, refreshed }
}

export async function healRecentPartnerMarketplaceNotifications(
  scope: PartnerScope
): Promise<HealPartnerNotificationsResult> {
  let scanned = 0
  let healed = 0
  let refreshed = 0

  for (let pass = 0; pass < HEAL_MAX_PASSES; pass++) {
    const batch = await healRecentPartnerMarketplaceNotificationsPass(scope)
    scanned += batch.scanned
    healed += batch.healed
    refreshed += batch.refreshed
    if (batch.scanned === 0 || (batch.healed === 0 && batch.refreshed === 0)) break
  }

  return { scanned, healed, refreshed }
}
