import { prisma } from "@/lib/prisma"
import {
  getActiveReturn,
  hasBlockingReturnHistory,
  orderReturnWindowEndsAt,
} from "@/lib/order-return-policy"
import { isTerminalReturnStatus } from "@/lib/order-return-types"
import { digitalPassPath } from "@/lib/digital-delivery/instant-fulfill"
import { bookingPassPath } from "@/lib/booking/pass-token"
import { isDigitalListingKind } from "@/lib/digital-delivery/types"
import { isBookableListingKind } from "@/lib/booking/types"
import {
  AUTO_CONFIRM_DAYS_AFTER_DELIVERY,
  orderPayoutTiming,
  PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM,
} from "@/lib/order-payout-policy"

export type BuyerOrderRow = {
  id: string
  fulfillmentSource: "marketplace" | "blind_dropship"
  createdAt: string
  quantity: number
  sellingPriceCents: number
  status: string
  supplierPreparingAt: string | null
  shippedAt: string | null
  trackingCarrier: string | null
  trackingNumber: string | null
  product: { id: string; name: string; imageUrl: string | null }
  returnWindowEndsAt: string
  returnEligible: boolean
  deliveredAt: string | null
  deliveryConfirmedAt: string | null
  canConfirmDelivery: boolean
  payoutEligibleAt: string | null
  payoutPolicy: { daysAfterConfirm: number; autoConfirmDays: number }
  activeReturn: {
    id: string
    status: string
    reasonCode: string
    createdAt: string
    sellerRespondByAt: string | null
    buyerTrackingCarrier: string | null
    buyerTrackingNumber: string | null
  } | null
  lastReturn: { id: string; status: string; createdAt: string; terminal: boolean } | null
  autoBuy?: {
    status: string
    labelFr: string
    labelEn: string
    aeTracking: string | null
  } | null
  isDigital: boolean
  digitalDeliveredAt: string | null
  digitalPassPath: string | null
  isBooking: boolean
  bookingConfirmedAt: string | null
  bookingPassPath: string | null
}

function autoBuyBuyerLabels(status: string): { labelFr: string; labelEn: string } {
  const map: Record<string, { labelFr: string; labelEn: string }> = {
    PENDING: { labelFr: "Achat fournisseur en attente", labelEn: "Supplier purchase pending" },
    BUYING: { labelFr: "Achat fournisseur en cours", labelEn: "Supplier purchase in progress" },
    BOUGHT: { labelFr: "Expédié par fournisseur", labelEn: "Shipped by supplier" },
    FAILED: { labelFr: "Problème fournisseur", labelEn: "Supplier issue" },
    REFUNDED: { labelFr: "Remboursé (rupture stock)", labelEn: "Refunded (out of stock)" },
  }
  return map[status] ?? { labelFr: "Fournisseur", labelEn: "Supplier" }
}

type AutoBuyLogSnippet = { status: string; aeTracking: string | null }

async function loadAutoBuyLogsByOrderId(
  orderIds: string[]
): Promise<Map<string, AutoBuyLogSnippet>> {
  if (orderIds.length === 0) return new Map()

  try {
    const logs = await prisma.fulfillmentLog.findMany({
      where: { orderId: { in: orderIds } },
      select: { orderId: true, status: true, aeTracking: true },
    })
    return new Map(logs.map((log) => [log.orderId, log]))
  } catch (e) {
    console.warn("[account-orders]", {
      metric: "auto_buy_log_query_skipped",
      error: e instanceof Error ? e.message : String(e),
    })
    return new Map()
  }
}

function blindReturnWindowEnds(createdAt: Date): Date {
  const d = new Date(createdAt)
  d.setDate(d.getDate() + 30)
  return d
}

export async function buildBuyerOrdersPayloadForEmail(customerEmail: string): Promise<BuyerOrderRow[]> {
  const normalized = customerEmail.trim().toLowerCase()
  const now = new Date()

  const [marketplaceOrders, blindOrders] = await Promise.all([
    prisma.order.findMany({
      where: { customerEmail: { equals: normalized, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        product: { select: { id: true, name: true, images: true } },
        returns: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.blindDropshipOrder.findMany({
      where: {
        customerEmail: { equals: normalized, mode: "insensitive" },
        status: { notIn: ["pending_payment", "failed"] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        items: {
          take: 1,
          include: { product: { select: { id: true, name: true, images: true } } },
        },
      },
    }),
  ])

  const autoBuyByOrderId = await loadAutoBuyLogsByOrderId(marketplaceOrders.map((o) => o.id))

  const rows: BuyerOrderRow[] = marketplaceOrders.map((o) => {
    const autoBuyLog = autoBuyByOrderId.get(o.id)
    const active = getActiveReturn(o.returns)
    const latest = o.returns[0] ?? null
    return {
      id: o.id,
      fulfillmentSource: "marketplace",
      createdAt: o.createdAt.toISOString(),
      quantity: o.quantity,
      sellingPriceCents: o.sellingPriceCents,
      status: o.status,
      supplierPreparingAt: o.supplierPreparingAt?.toISOString() ?? null,
      shippedAt: o.shippedAt?.toISOString() ?? null,
      trackingCarrier: o.trackingCarrier,
      trackingNumber: o.trackingNumber,
      product: {
        id: o.product.id,
        name: o.product.name,
        imageUrl: o.product.images[0] ?? null,
      },
      returnWindowEndsAt: orderReturnWindowEndsAt(o).toISOString(),
      returnEligible:
        (o.status === "paid" || o.status === "shipped") &&
        now <= orderReturnWindowEndsAt(o) &&
        !hasBlockingReturnHistory(o.returns),
      deliveredAt: (o.deliveredAt ?? o.shippedAt)?.toISOString() ?? null,
      deliveryConfirmedAt: o.deliveryConfirmedAt?.toISOString() ?? null,
      canConfirmDelivery:
        o.status === "shipped" &&
        Boolean(o.deliveredAt ?? o.shippedAt) &&
        !o.deliveryConfirmedAt &&
        !active,
      payoutEligibleAt: orderPayoutTiming(o)?.payoutEligibleAt?.toISOString() ?? null,
      payoutPolicy: {
        daysAfterConfirm: PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM,
        autoConfirmDays: AUTO_CONFIRM_DAYS_AFTER_DELIVERY,
      },
      activeReturn: active
        ? {
            id: active.id,
            status: active.status,
            reasonCode: active.reasonCode,
            createdAt: active.createdAt.toISOString(),
            sellerRespondByAt: active.sellerRespondByAt?.toISOString() ?? null,
            buyerTrackingCarrier: active.buyerTrackingCarrier,
            buyerTrackingNumber: active.buyerTrackingNumber,
          }
        : null,
      lastReturn: latest
        ? {
            id: latest.id,
            status: latest.status,
            createdAt: latest.createdAt.toISOString(),
            terminal: isTerminalReturnStatus(latest.status),
          }
        : null,
      autoBuy: autoBuyLog
        ? {
            status: autoBuyLog.status,
            ...autoBuyBuyerLabels(autoBuyLog.status),
            aeTracking: autoBuyLog.aeTracking,
          }
        : null,
      isDigital: isDigitalListingKind(o.listingKindSnapshot),
      digitalDeliveredAt: o.digitalDeliveredAt?.toISOString() ?? null,
      digitalPassPath:
        o.digitalAccessToken && o.digitalDeliveredAt
          ? digitalPassPath(o.digitalAccessToken)
          : null,
      isBooking: isBookableListingKind(o.listingKindSnapshot),
      bookingConfirmedAt: o.bookingConfirmedAt?.toISOString() ?? null,
      bookingPassPath:
        o.bookingToken && o.bookingConfirmedAt ? bookingPassPath(o.bookingToken) : null,
    }
  })

  for (const b of blindOrders) {
    const first = b.items[0]
    const windowEnd = blindReturnWindowEnds(b.createdAt)
    const timing = orderPayoutTiming({
      shippedAt: b.deliveredAt,
      deliveredAt: b.deliveredAt,
      deliveryConfirmedAt: b.deliveryConfirmedAt,
      deliveryConfirmedBy: b.deliveryConfirmedBy,
      payoutEligibleAt: b.payoutEligibleAt,
    })
    const name =
      b.items.length > 1
        ? `${first?.product.name ?? "Order"} (+${b.items.length - 1})`
        : first?.product.name ?? "Blind dropship order"

    rows.push({
      id: b.id,
      fulfillmentSource: "blind_dropship",
      createdAt: b.createdAt.toISOString(),
      quantity: b.items.reduce((a, it) => a + it.quantity, 0) || 1,
      sellingPriceCents: b.totalPaidCents,
      status: b.status,
      supplierPreparingAt: null,
      shippedAt: b.deliveredAt?.toISOString() ?? null,
      trackingCarrier: b.trackingCarrier,
      trackingNumber: b.trackingNumber,
      product: {
        id: first?.product.id ?? b.id,
        name,
        imageUrl: first?.product.images[0] ?? null,
      },
      returnWindowEndsAt: windowEnd.toISOString(),
      returnEligible: b.status === "shipped" && now <= windowEnd,
      deliveredAt: b.deliveredAt?.toISOString() ?? null,
      deliveryConfirmedAt: b.deliveryConfirmedAt?.toISOString() ?? null,
      canConfirmDelivery: b.status === "shipped" && Boolean(b.deliveredAt) && !b.deliveryConfirmedAt,
      payoutEligibleAt: timing?.payoutEligibleAt?.toISOString() ?? null,
      payoutPolicy: {
        daysAfterConfirm: PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM,
        autoConfirmDays: AUTO_CONFIRM_DAYS_AFTER_DELIVERY,
      },
      activeReturn: null,
      lastReturn: null,
      isDigital: false,
      digitalDeliveredAt: null,
      digitalPassPath: null,
      isBooking: false,
      bookingConfirmedAt: null,
      bookingPassPath: null,
    })
  }

  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return rows.slice(0, 100)
}
