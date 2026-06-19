import type { Prisma } from "@prisma/client"

import { createMarketplaceOrderNotifications } from "@/lib/marketplace-order-notifications"
import { affiliateSaleNotificationSettlement } from "@/lib/marketplace-order-settlement"
import { prisma } from "@/lib/prisma"

const PARTNER_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000
const HEAL_BATCH_SIZE = 15

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

  if (!order || order.status !== "paid") {
    return { supplierInboxCreated: false, affiliateInboxCreated: false }
  }

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
}

export type HealPartnerNotificationsResult = {
  scanned: number
  healed: number
}

type PartnerScope = { supplierId: string } | { affiliateId: string }

/** Heal recent paid orders missing inbox alerts for one supplier or affiliate dashboard. */
export async function healRecentPartnerMarketplaceNotifications(
  scope: PartnerScope
): Promise<HealPartnerNotificationsResult> {
  const partnerWhere =
    "supplierId" in scope ? { supplierId: scope.supplierId } : { affiliateId: scope.affiliateId }
  const inboxType = "supplierId" in scope ? ("NEW_ORDER" as const) : ("NEW_SALE" as const)
  const userId = "supplierId" in scope ? scope.supplierId : scope.affiliateId

  const recentPaid = await prisma.order.findMany({
    where: {
      ...partnerWhere,
      status: "paid",
      paidAt: { gte: new Date(Date.now() - PARTNER_LOOKBACK_MS) },
    },
    select: { id: true },
    orderBy: { paidAt: "desc" },
    take: HEAL_BATCH_SIZE,
  })

  if (recentPaid.length === 0) {
    return { scanned: 0, healed: 0 }
  }

  const existing = await prisma.notification.findMany({
    where: {
      userId,
      type: inboxType,
      orderId: { in: recentPaid.map((row) => row.id) },
    },
    select: { orderId: true },
  })
  const covered = new Set(existing.map((row) => row.orderId).filter(Boolean))

  let healed = 0
  for (const row of recentPaid) {
    if (covered.has(row.id)) continue
    const result = await healMarketplaceOrderNotifications(row.id)
    if (
      ("supplierId" in scope && result.supplierInboxCreated) ||
      ("affiliateId" in scope && result.affiliateInboxCreated)
    ) {
      healed += 1
    }
  }

  return { scanned: recentPaid.length, healed }
}
