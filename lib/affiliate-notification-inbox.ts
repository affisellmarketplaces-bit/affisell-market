import "server-only"

import { dedupeMerchantNotifications } from "@/lib/merchant-notifications-dedupe"
import {
  resolveAffiliateSaleNotificationBreakdown,
} from "@/lib/marketplace-order-notification-breakdown"
import type { AffiliateSaleOrderAmounts } from "@/lib/marketplace-order-notification-types"
import { parseAffiliateSaleNotification } from "@/lib/merchant-notification-display"
import type {
  AffiliateNotificationInboxPayload,
  AffiliateNotificationInboxRow,
} from "@/lib/affiliate-notification-inbox-types"
import { prisma } from "@/lib/prisma"

function mapAffiliateNotificationRows(
  affiliateId: string,
  rows: Array<{
    id: string
    type: string
    message: string
    imageUrl: string | null
    orderId: string | null
    read: boolean
    createdAt: Date
  }>,
  orderById: Map<string, AffiliateSaleOrderAmounts & { variantImageUrl: string | null }>
): AffiliateNotificationInboxRow[] {
  const imageByOrderId = new Map(
    [...orderById.entries()].map(([id, o]) => [id, o.variantImageUrl])
  )

  const deduped = dedupeMerchantNotifications(rows)

  return deduped.map((n) => {
    const order = n.type === "NEW_SALE" && n.orderId ? orderById.get(n.orderId) : undefined
    const parsed = n.type === "NEW_SALE" ? parseAffiliateSaleNotification(n.message) : null
    const breakdown =
      order != null
        ? resolveAffiliateSaleNotificationBreakdown({
            parsed: parsed?.breakdown,
            order,
          })
        : undefined

    return {
      id: n.id,
      type: n.type,
      message: n.message,
      imageUrl: n.imageUrl?.trim() || imageByOrderId.get(n.orderId ?? "")?.trim() || null,
      orderId: n.orderId,
      read: n.read,
      createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : String(n.createdAt),
      ...(breakdown && Object.values(breakdown).some(Boolean) ? { breakdown } : {}),
    }
  })
}

async function readAffiliateNotificationInbox(
  affiliateId: string
): Promise<AffiliateNotificationInboxPayload> {
  const rows = await prisma.notification.findMany({
    where: { userId: affiliateId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const saleOrderIds = rows
    .filter((n) => n.type === "NEW_SALE" && n.orderId)
    .map((n) => n.orderId!)

  const ordersForBreakdown =
    saleOrderIds.length > 0
      ? await prisma.order.findMany({
          where: { id: { in: saleOrderIds }, affiliateId },
          select: {
            id: true,
            variantImageUrl: true,
            subtotalCents: true,
            sellingPriceCents: true,
            totalCents: true,
            taxCents: true,
            supplierPriceCents: true,
            basePriceCents: true,
            marginCents: true,
            affisellFeeCents: true,
            commissionCents: true,
            affiliatePayoutCents: true,
            affiliateMarginRetainedCents: true,
            affiliateFeeCents: true,
            affiliateMarginCents: true,
            supplierPayoutCents: true,
          },
        })
      : []

  const orderById = new Map(ordersForBreakdown.map((o) => [o.id, o]))
  const notifications = mapAffiliateNotificationRows(affiliateId, rows, orderById)
  const unreadCount = notifications.filter((n) => !n.read).length

  return { unreadCount, notifications }
}

/** Kick off Stripe reconcile + inbox heal without blocking the response. */
export function scheduleAffiliateMarketplaceAlertSync(
  affiliateId: string,
  options?: { force?: boolean }
): void {
  void (async () => {
    try {
      const { syncPartnerMarketplaceAlertsBeforeInboxIfDue } = await import(
        "@/lib/marketplace-order-notification-sync"
      )
      await syncPartnerMarketplaceAlertsBeforeInboxIfDue(
        { affiliateId },
        { force: options?.force ?? false }
      )
    } catch (error) {
      console.error("[affiliate-notifications]", {
        affiliateId,
        stage: "background_sync",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })()
}

/**
 * Read affiliate sale alerts from inbox — optionally sync first when force=true.
 * Default: return persisted rows immediately (SSR + fast poll), heal in background.
 */
export async function loadAffiliateNotificationInbox(
  affiliateId: string,
  options?: { forceSync?: boolean; skipBackgroundSync?: boolean }
): Promise<AffiliateNotificationInboxPayload> {
  if (options?.forceSync) {
    try {
      const { syncPartnerMarketplaceAlertsBeforeInboxIfDue } = await import(
        "@/lib/marketplace-order-notification-sync"
      )
      await syncPartnerMarketplaceAlertsBeforeInboxIfDue(
        { affiliateId },
        { force: true }
      )
    } catch (error) {
      console.error("[affiliate-notifications]", {
        affiliateId,
        stage: "sync",
        error: error instanceof Error ? error.message : String(error),
      })
    }
    const payload = await readAffiliateNotificationInbox(affiliateId)
    console.log("[affiliate-notifications]", {
      affiliateId,
      unreadCount: payload.unreadCount,
      notificationRows: payload.notifications.length,
      result: "ok_force_sync",
    })
    return payload
  }

  const payload = await readAffiliateNotificationInbox(affiliateId)

  if (!options?.skipBackgroundSync) {
    scheduleAffiliateMarketplaceAlertSync(affiliateId)
  }

  console.log("[affiliate-notifications]", {
    affiliateId,
    unreadCount: payload.unreadCount,
    notificationRows: payload.notifications.length,
    result: "ok",
  })

  return payload
}
