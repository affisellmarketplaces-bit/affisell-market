import type { Prisma } from "@prisma/client"

import { createMarketplaceOrderNotifications } from "@/lib/marketplace-order-notifications"
import { affiliateSaleNotificationSettlement } from "@/lib/marketplace-order-settlement"
import { prisma } from "@/lib/prisma"

const PARTNER_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000
const HEAL_BATCH_SIZE = 30
const HEAL_MAX_PASSES = 3

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
  supplierPayoutCents: true,
  supplierFeeCents: true,
  commissionCents: true,
  affiliateMarginRetainedCents: true,
  affiliateFeeCents: true,
  affisellFeeCents: true,
  marginCents: true,
  usesAffisellAutoBuy: true,
  paidAt: true,
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
}

function buildHealArgs(order: OrderForHeal) {
  const lineHtCents = order.subtotalCents ?? order.sellingPriceCents ?? order.totalCents ?? 0
  const settlement = affiliateSaleNotificationSettlement(
    {
      sellingPriceCents: lineHtCents,
      basePriceCents: order.supplierPriceCents,
      marginCents: order.marginCents,
      affisellFeeBaseCents: lineHtCents,
      affisellFeeCents: order.affisellFeeCents,
      affiliateCommissionCents: order.commissionCents,
      affiliateMarginRetainedCents: order.affiliateMarginRetainedCents ?? 0,
      supplierNetCents: order.supplierPayoutCents,
      affiliatePlatformFeeCents: order.affiliateFeeCents,
    },
    {
      affiliateMarginRetainedCents: order.affiliateMarginRetainedCents ?? 0,
      affiliatePlatformFeeCents: order.affiliateFeeCents,
    }
  )

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

function resolvePartnerListingCodeForHeal(order: OrderForHeal): string | null {
  const fromListing = order.affiliateProduct?.affiliate?.store?.partnerListingCode?.trim()
  if (fromListing) return fromListing
  return order.affiliate?.store?.partnerListingCode?.trim() || null
}

/** Idempotent heal for one paid marketplace order (fixes missing supplier/affiliate inbox rows). */
export async function healMarketplaceOrderNotifications(
  orderId: string
): Promise<HealMarketplaceOrderNotificationsResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: orderForHealSelect,
  })

  if (!order || !HEALABLE_ORDER_STATUSES.includes(order.status as (typeof HEALABLE_ORDER_STATUSES)[number])) {
    return { supplierInboxCreated: false, affiliateInboxCreated: false }
  }

  try {
    const result = await prisma.$transaction((tx) =>
      createMarketplaceOrderNotifications(tx, buildHealArgs(order))
    )

    if (result.supplierInboxCreated || result.affiliateInboxCreated) {
      console.log("[marketplace-order-notification-heal]", {
        orderId,
        supplierInboxCreated: result.supplierInboxCreated,
        affiliateInboxCreated: result.affiliateInboxCreated,
      })
    }

    return result
  } catch (error) {
    console.error("[marketplace-order-notification-heal]", {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { supplierInboxCreated: false, affiliateInboxCreated: false }
  }
}

export type HealPartnerNotificationsResult = {
  scanned: number
  healed: number
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

  if (missingAlertOrders.length === 0) {
    return { scanned: 0, healed: 0 }
  }

  let healed = 0
  for (const row of missingAlertOrders) {
    const result = await healMarketplaceOrderNotifications(row.id)
    if (
      ("supplierId" in scope && result.supplierInboxCreated) ||
      ("affiliateId" in scope && result.affiliateInboxCreated)
    ) {
      healed += 1
    }
  }

  return { scanned: missingAlertOrders.length, healed }
}

export async function healRecentPartnerMarketplaceNotifications(
  scope: PartnerScope
): Promise<HealPartnerNotificationsResult> {
  let scanned = 0
  let healed = 0

  for (let pass = 0; pass < HEAL_MAX_PASSES; pass++) {
    const batch = await healRecentPartnerMarketplaceNotificationsPass(scope)
    scanned += batch.scanned
    healed += batch.healed
    if (batch.scanned === 0 || batch.healed === 0) break
  }

  return { scanned, healed }
}
