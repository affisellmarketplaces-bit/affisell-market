import type { Prisma } from "@prisma/client"

import { aggregateBlindLinesForSupplier } from "@/lib/blind-dropship-settlement"
import { resolveMarketplaceOrderLineImageUrl } from "@/lib/cart-line-image"
import { formatOrderShippingAddress } from "@/lib/order-shipping-address"
import { extractShippingCountryIso2FromAddress } from "@/lib/trusted-carriers-shared"
import { isSupplierTrackingLocked } from "@/lib/order-tracking-lock.shared"
import { resolveSupplierPayoutCentsFromOrder } from "@/lib/marketplace-order-settlement"
import { orderPayoutTiming, payoutStatusLabel } from "@/lib/order-payout-policy"
import { prisma } from "@/lib/prisma"
import { buildShipPulseSnapshot, resolveShipDeadlineAt } from "@/lib/supplier-ship-sla-shared"

const orderInclude = {
  product: {
    select: {
      id: true,
      name: true,
      images: true,
      colors: true,
      colorImages: true,
      variants: true,
      supplierSku: true,
    },
  },
  affiliateProduct: { select: { customImages: true } },
  affiliate: { select: { store: { select: { partnerListingCode: true } } } },
  returns: {
    where: { status: { notIn: ["REJECTED", "CANCELLED", "REFUNDED"] as string[] } },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, status: true },
  },
  shipExtensions: {
    where: { status: "PENDING" },
    take: 1,
    select: { id: true },
  },
} satisfies Prisma.OrderInclude

export { orderInclude as supplierOrderInclude }

export type SupplierFulfillmentOrder = {
  id: string
  fulfillmentSource: "marketplace" | "blind_dropship"
  status: string
  displayStatus: string
  fulfillmentStatus: string
  payoutStatusDb: string
  quantity: number
  variantLabel: string | null
  customerEmail: string
  /** Supplier wholesale / COGS for the line (your payout basis). */
  supplierNetCents: number
  /** Affisell platform fee on your wholesale (catalogue / auto-buy %). */
  supplierPlatformFeeCents: number
  /** Commission funded from your wholesale per catalog offer (`commissionRate`). */
  affiliateCommissionCents: number
  partnerListingCode: string | null
  createdAt: string
  shippedAt: string | null
  trackingCarrier: string | null
  trackingNumber: string | null
  trackingLocked: boolean
  trackingVerifiedBy: string | null
  shippingAddressFormatted: string
  shippingCountryIso2: string
  canMarkShipped: boolean
  product: {
    id: string
    name: string
    imageUrl: string | null
    supplierSku: string | null
  }
  openReturn: { id: string; status: string } | null
  supplierPayoutAt: string | null
  affiliatePayoutAt: string | null
  payoutStatus: string
  payoutEligibleAt: string | null
  deliveryConfirmedAt: string | null
  supplierPreparingAt: string | null
  canMarkPreparing: boolean
  /** Ship Pulse countdown (marketplace orders awaiting shipment only). */
  shipPulse: {
    deadlineAt: string
    msRemaining: number
    phase: "safe" | "urgent" | "critical" | "breached"
  } | null
}

type SupplierOrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>

function orderLineImageUrl(o: SupplierOrderRow): string | null {
  const snap = o.variantImageUrl?.trim()
  if (snap) return snap
  const resolved = resolveMarketplaceOrderLineImageUrl(
    { customImages: o.affiliateProduct.customImages, product: o.product },
    o.variantLabel
  )
  return resolved || o.product.images[0] || null
}

export function mapMarketplaceOrder(o: SupplierOrderRow): SupplierFulfillmentOrder {
  const openReturn = o.returns[0] ?? null
  const store = o.affiliate.store
  const imageUrl = orderLineImageUrl(o)
  return {
    id: o.id,
    fulfillmentSource: "marketplace",
    status: o.status,
    fulfillmentStatus: o.fulfillmentStatus,
    payoutStatusDb: o.payoutStatus,
    displayStatus:
      o.status === "paid"
        ? "Awaiting packing"
        : o.status === "preparing"
          ? "Preparing"
          : o.status === "shipped"
            ? "Shipped"
            : o.status,
    quantity: o.quantity,
    variantLabel: o.variantLabel,
    customerEmail: o.customerEmail,
    supplierNetCents: resolveSupplierPayoutCentsFromOrder(o),
    supplierPlatformFeeCents: Math.max(0, o.supplierFeeCents ?? 0),
    affiliateCommissionCents: o.affiliatePayoutCents,
    partnerListingCode: store?.partnerListingCode ?? null,
    createdAt: o.createdAt.toISOString(),
    shippedAt: o.shippedAt?.toISOString() ?? null,
    trackingCarrier: o.trackingCarrier,
    trackingNumber: o.trackingNumber,
    trackingLocked: isSupplierTrackingLocked({
      trackingLockedAt: o.trackingLockedAt,
      trackingNumber: o.trackingNumber,
      status: o.status,
    }),
    trackingVerifiedBy: o.trackingVerifiedBy,
    shippingAddressFormatted: formatOrderShippingAddress(o.shippingAddress),
    shippingCountryIso2: extractShippingCountryIso2FromAddress(o.shippingAddress),
    canMarkPreparing: o.status === "paid",
    canMarkShipped:
      (o.status === "paid" || o.status === "preparing") &&
      !isSupplierTrackingLocked({
        trackingLockedAt: o.trackingLockedAt,
        trackingNumber: o.trackingNumber,
        status: o.status,
      }),
    supplierPreparingAt: o.supplierPreparingAt?.toISOString() ?? null,
    product: {
      id: o.product.id,
      name: o.product.name,
      imageUrl,
      supplierSku: o.product.supplierSku,
    },
    openReturn: openReturn ? { id: openReturn.id, status: openReturn.status } : null,
    supplierPayoutAt: o.supplierPayoutAt?.toISOString() ?? null,
    affiliatePayoutAt: o.affiliatePayoutAt?.toISOString() ?? null,
    payoutStatus: payoutStatusLabel(o),
    payoutEligibleAt: orderPayoutTiming(o)?.payoutEligibleAt?.toISOString() ?? null,
    deliveryConfirmedAt: o.deliveryConfirmedAt?.toISOString() ?? null,
    shipPulse:
      o.status === "paid" || o.status === "preparing"
        ? (() => {
            const pulse = buildShipPulseSnapshot(
              resolveShipDeadlineAt({
                shipDeadlineAt: o.shipDeadlineAt,
                paidAt: o.paidAt,
                createdAt: o.createdAt,
              }),
              Date.now(),
              { extensionPending: o.shipExtensions.length > 0 }
            )
            return {
              deadlineAt: pulse.deadlineAt,
              msRemaining: pulse.msRemaining,
              phase: pulse.phase,
              extensionPending: pulse.extensionPending,
            }
          })()
        : null,
  }
}

function blindDisplayStatus(status: string): string {
  if (status === "shipped") return "Shipped"
  if (status === "fulfilling") return "Partner API"
  if (status === "awaiting_manual_payment") return "Awaiting payment"
  if (status === "paid") return "To ship"
  return status
}

function mapBlindOrder(
  order: {
    id: string
    status: string
    customerEmail: string
    shippingAddress: unknown
    createdAt: Date
    updatedAt: Date
    totalPaidCents: number
    totalCostCents: number
    affisellFeeCents: number
    affiliateCommissionCents: number
    affiliateMarginRetainedCents: number
    deliveredAt: Date | null
    deliveryConfirmedAt: Date | null
    supplierPayoutAt: Date | null
    affiliatePayoutAt: Date | null
    payoutEligibleAt: Date | null
    trackingCarrier: string | null
    trackingNumber: string | null
    affiliate: { id: string; store: { partnerListingCode: string } | null }
    items: {
      quantity: number
      supplierSkuAtOrder: string
      linePaidCents: number
      marginCents: number
      affisellFeeCents: number
      affiliateCommissionCents: number
      affiliateMarginRetainedCents: number
      supplierPriceAtOrderCents: number
      blindDropshipSupplierId: string
      product: { id: string; name: string; images: string[]; supplierSku: string | null }
    }[]
  },
  blindSupplierId: string
): SupplierFulfillmentOrder {
  const lineMeta = order.items.map((it) => ({
    blindDropshipSupplierId: it.blindDropshipSupplierId,
    settlement: {
      sellingPriceCents: it.linePaidCents,
      basePriceCents: it.supplierPriceAtOrderCents * it.quantity,
      marginCents: it.marginCents,
      affisellFeeBaseCents: it.linePaidCents,
      affisellFeeCents: it.affisellFeeCents,
      affiliateCommissionCents: it.affiliateCommissionCents,
      affiliateMarginRetainedCents: it.affiliateMarginRetainedCents,
      supplierNetCents: Math.max(
        0,
        it.supplierPriceAtOrderCents * it.quantity - it.affiliateCommissionCents
      ),
    },
  }))
  const slice = aggregateBlindLinesForSupplier(lineMeta, blindSupplierId)
  const first = order.items[0]!
  const names = order.items.map((it) => `${it.product.name} ×${it.quantity}`).join(", ")
  const qty = order.items.reduce((a, it) => a + it.quantity, 0)
  const store = order.affiliate.store

  return {
    id: order.id,
    fulfillmentSource: "blind_dropship",
    status: order.status,
    fulfillmentStatus: order.status === "shipped" ? "SHIPPED" : "PENDING",
    payoutStatusDb: order.supplierPayoutAt ? "PAID" : "PENDING",
    displayStatus: blindDisplayStatus(order.status),
    quantity: qty,
    variantLabel: null,
    customerEmail: order.customerEmail,
    supplierNetCents: slice.supplierNetCents,
    supplierPlatformFeeCents: slice.affisellFeeCents,
    affiliateCommissionCents: slice.affiliateCommissionCents,
    partnerListingCode: store?.partnerListingCode ?? null,
    createdAt: order.createdAt.toISOString(),
    shippedAt: order.status === "shipped" ? order.updatedAt.toISOString() : null,
    trackingCarrier: order.trackingCarrier,
    trackingNumber: order.trackingNumber,
    trackingLocked: Boolean(order.trackingNumber),
    trackingVerifiedBy: order.trackingNumber ? "partner" : null,
    shippingAddressFormatted: formatOrderShippingAddress(order.shippingAddress),
    shippingCountryIso2: extractShippingCountryIso2FromAddress(order.shippingAddress),
    canMarkShipped: false,
    canMarkPreparing: false,
    supplierPreparingAt: null,
    product: {
      id: first.product.id,
      name: names,
      imageUrl: first.product.images[0] ?? null,
      supplierSku: first.supplierSkuAtOrder || first.product.supplierSku,
    },
    openReturn: null,
    supplierPayoutAt: order.supplierPayoutAt?.toISOString() ?? null,
    affiliatePayoutAt: order.affiliatePayoutAt?.toISOString() ?? null,
    payoutStatus:
      order.supplierPayoutAt && order.affiliatePayoutAt
        ? "Paid out"
        : order.payoutEligibleAt && new Date() >= order.payoutEligibleAt
          ? "Payout pending"
          : blindDisplayStatus(order.status),
    payoutEligibleAt: order.payoutEligibleAt?.toISOString() ?? null,
    deliveryConfirmedAt: order.deliveryConfirmedAt?.toISOString() ?? null,
    shipPulse: null,
  }
}

function marketplaceStatusFilter(tab: "to_ship" | "shipped" | "all") {
  if (tab === "to_ship") return { status: { in: ["paid", "preparing"] as string[] } }
  if (tab === "shipped") return { status: "shipped" as const }
  return { status: { in: ["paid", "preparing", "shipped"] as string[] } }
}

function blindStatusFilter(tab: "to_ship" | "shipped" | "all"): string[] {
  if (tab === "to_ship") return ["paid", "fulfilling", "awaiting_manual_payment"]
  if (tab === "shipped") return ["shipped"]
  return ["paid", "fulfilling", "awaiting_manual_payment", "shipped"]
}

export async function fetchSupplierOrders(
  supplierId: string,
  tab: "to_ship" | "shipped" | "all"
): Promise<SupplierFulfillmentOrder[]> {
  const [marketplaceRows, blindProfile] = await Promise.all([
    prisma.order.findMany({
      where: { supplierId, ...marketplaceStatusFilter(tab) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: orderInclude,
    }),
    prisma.blindDropshipSupplier.findUnique({
      where: { linkedUserId: supplierId },
      select: { id: true },
    }),
  ])

  const mapped: SupplierFulfillmentOrder[] = marketplaceRows.map(mapMarketplaceOrder)

  if (blindProfile) {
    const blindOrders = await prisma.blindDropshipOrder.findMany({
      where: {
        status: { in: blindStatusFilter(tab) },
        items: { some: { blindDropshipSupplierId: blindProfile.id } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        affiliate: { select: { id: true, store: { select: { partnerListingCode: true } } } },
        items: {
          where: { blindDropshipSupplierId: blindProfile.id },
          include: {
            product: { select: { id: true, name: true, images: true, supplierSku: true } },
          },
        },
      },
    })
    for (const o of blindOrders) {
      if (o.items.length > 0) {
        mapped.push(mapBlindOrder(o, blindProfile.id))
      }
    }
  }

  mapped.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return mapped.slice(0, 200)
}

export async function countSupplierOrdersToShip(supplierId: string): Promise<number> {
  const blindProfile = await prisma.blindDropshipSupplier.findUnique({
    where: { linkedUserId: supplierId },
    select: { id: true },
  })

  const [marketplace, blind] = await Promise.all([
    prisma.order.count({ where: { supplierId, status: { in: ["paid", "preparing"] } } }),
    blindProfile
      ? prisma.blindDropshipOrder.count({
          where: {
            status: { in: ["paid", "fulfilling", "awaiting_manual_payment"] },
            items: { some: { blindDropshipSupplierId: blindProfile.id } },
          },
        })
      : Promise.resolve(0),
  ])

  return marketplace + blind
}

/** True when id is a blind dropship order owned by this supplier (no manual mark-shipped). */
export async function isSupplierBlindDropshipOrder(
  orderId: string,
  supplierUserId: string
): Promise<boolean> {
  const row = await prisma.blindDropshipOrder.findFirst({
    where: {
      id: orderId,
      items: { some: { blindDropshipSupplier: { linkedUserId: supplierUserId } } },
    },
    select: { id: true },
  })
  return Boolean(row)
}
