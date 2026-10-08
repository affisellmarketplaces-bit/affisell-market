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
import { loadNotificationOrderSummaries } from "@/lib/merchant-notification-order-summary"
import type { MerchantNotificationOrderSummary } from "@/lib/merchant-notification-order-summary-types"
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
  orderById: Map<string, AffiliateSaleOrderAmounts & { variantImageUrl: string | null }>,
  summaries: Map<string, MerchantNotificationOrderSummary>
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
      imageUrl:
        n.imageUrl?.trim() ||
        imageByOrderId.get(n.orderId ?? "")?.trim() ||
        summaries.get(n.orderId ?? "")?.imageUrl ||
        null,
      ...(n.orderId && summaries.has(n.orderId) ? { order: summaries.get(n.orderId) } : {}),
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
            supplierCommissionRateBps: true,
            supplierPayoutCents: true,
          },
        })
      : []

  const orderById = new Map(ordersForBreakdown.map((o) => [o.id, o]))
  const summaries = await loadNotificationOrderSummaries(
    affiliateId,
    rows.map((n) => n.orderId).filter((id): id is string => Boolean(id)),
    "AFFILIATE"
  )
  const notifications = mapAffiliateNotificationRows(affiliateId, rows, orderById, summaries)
  const unreadCount = notifications.filter((n) => !n.read).length

  return { unreadCount, notifications }
}

/**
 * Read affiliate sale alerts from the inbox. READ-ONLY.
 *
 * It used to kick off a floating `void (async () => …)()` Stripe reconcile + inbox heal after every read. That work
 * was cut or frozen once the response was sent (no `waitUntil`), leaving Prisma transactions open until they expired
 * (the bulk of the production "Transaction already closed" errors, 2026-10). Reading the inbox now never starts any
 * business catch-up, implicit or not: that is an explicit mechanism, decided separately, which calls
 * `lib/marketplace-order-notification-sync` itself. Guarded by `lib/__tests__/notifications-get-read-only.test.ts`.
 */
export async function loadAffiliateNotificationInbox(
  affiliateId: string
): Promise<AffiliateNotificationInboxPayload> {
  const payload = await readAffiliateNotificationInbox(affiliateId)

  console.log("[affiliate-notifications]", {
    affiliateId,
    unreadCount: payload.unreadCount,
    notificationRows: payload.notifications.length,
    result: "ok",
  })

  return payload
}
