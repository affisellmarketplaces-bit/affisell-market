import { prisma } from "@/lib/prisma"
import {
  getActiveReturn,
  hasBlockingReturnHistory,
  orderReturnWindowEndsAt,
} from "@/lib/order-return-policy"
import { isTerminalReturnStatus } from "@/lib/order-return-types"
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

  const rows: BuyerOrderRow[] = marketplaceOrders.map((o) => {
    const active = getActiveReturn(o.returns)
    const latest = o.returns[0] ?? null
    return {
      id: o.id,
      fulfillmentSource: "marketplace",
      createdAt: o.createdAt.toISOString(),
      quantity: o.quantity,
      sellingPriceCents: o.sellingPriceCents,
      status: o.status,
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
    })
  }

  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return rows.slice(0, 100)
}
