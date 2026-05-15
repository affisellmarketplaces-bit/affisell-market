import type { Prisma } from "@prisma/client"

import { aggregateBlindLinesForSupplier } from "@/lib/blind-dropship-settlement"
import { formatOrderShippingAddress } from "@/lib/order-shipping-address"
import { orderPayoutTiming, payoutStatusLabel } from "@/lib/order-payout-policy"
import { prisma } from "@/lib/prisma"

const orderInclude = {
  product: { select: { id: true, name: true, images: true, supplierSku: true } },
  affiliate: { select: { id: true, name: true, email: true, store: { select: { name: true, slug: true } } } },
  returns: {
    where: { status: { notIn: ["REJECTED", "CANCELLED", "REFUNDED"] as string[] } },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, status: true },
  },
} satisfies Prisma.OrderInclude

export { orderInclude as supplierOrderInclude }

export type SupplierFulfillmentOrder = {
  id: string
  fulfillmentSource: "marketplace" | "blind_dropship"
  status: string
  displayStatus: string
  quantity: number
  variantLabel: string | null
  customerEmail: string
  sellingPriceCents: number
  basePriceCents: number
  marginCents: number
  affisellFeeCents: number
  affiliateCommissionCents: number
  affiliateMarginRetainedCents: number
  supplierNetCents: number
  createdAt: string
  shippedAt: string | null
  trackingCarrier: string | null
  trackingNumber: string | null
  shippingAddressFormatted: string
  canMarkShipped: boolean
  product: {
    id: string
    name: string
    imageUrl: string | null
    supplierSku: string | null
  }
  affiliate: {
    id: string
    name: string | null
    storeName: string | null
    storeSlug: string | null
  }
  openReturn: { id: string; status: string } | null
  supplierPayoutAt: string | null
  affiliatePayoutAt: string | null
  payoutStatus: string
  payoutEligibleAt: string | null
  deliveryConfirmedAt: string | null
}

type SupplierOrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>

export function mapMarketplaceOrder(o: SupplierOrderRow): SupplierFulfillmentOrder {
  const openReturn = o.returns[0] ?? null
  const store = o.affiliate.store
  return {
    id: o.id,
    fulfillmentSource: "marketplace",
    status: o.status,
    displayStatus: o.status === "paid" ? "To ship" : o.status === "shipped" ? "Shipped" : o.status,
    quantity: o.quantity,
    variantLabel: o.variantLabel,
    customerEmail: o.customerEmail,
    sellingPriceCents: o.sellingPriceCents,
    basePriceCents: o.basePriceCents,
    marginCents: o.marginCents,
    affisellFeeCents: o.affisellFeeCents,
    affiliateCommissionCents: o.affiliatePayoutCents,
    affiliateMarginRetainedCents: o.affiliateMarginRetainedCents,
    supplierNetCents: o.basePriceCents,
    createdAt: o.createdAt.toISOString(),
    shippedAt: o.shippedAt?.toISOString() ?? null,
    trackingCarrier: o.trackingCarrier,
    trackingNumber: o.trackingNumber,
    shippingAddressFormatted: formatOrderShippingAddress(o.shippingAddress),
    canMarkShipped: o.status === "paid",
    product: {
      id: o.product.id,
      name: o.product.name,
      imageUrl: o.product.images[0] ?? null,
      supplierSku: o.product.supplierSku,
    },
    affiliate: {
      id: o.affiliate.id,
      name: o.affiliate.name,
      storeName: store?.name ?? null,
      storeSlug: store?.slug ?? null,
    },
    openReturn: openReturn ? { id: openReturn.id, status: openReturn.status } : null,
    supplierPayoutAt: o.supplierPayoutAt?.toISOString() ?? null,
    affiliatePayoutAt: o.affiliatePayoutAt?.toISOString() ?? null,
    payoutStatus: payoutStatusLabel(o),
    payoutEligibleAt: orderPayoutTiming(o)?.payoutEligibleAt?.toISOString() ?? null,
    deliveryConfirmedAt: o.deliveryConfirmedAt?.toISOString() ?? null,
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
    affiliate: { id: string; name: string | null; store: { name: string; slug: string } | null }
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
      affisellFeeCents: it.affisellFeeCents,
      affiliateCommissionCents: it.affiliateCommissionCents,
      affiliateMarginRetainedCents: it.affiliateMarginRetainedCents,
      supplierNetCents: it.supplierPriceAtOrderCents * it.quantity,
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
    displayStatus: blindDisplayStatus(order.status),
    quantity: qty,
    variantLabel: null,
    customerEmail: order.customerEmail,
    sellingPriceCents: slice.sellingPriceCents,
    basePriceCents: slice.basePriceCents,
    marginCents: slice.marginCents,
    affisellFeeCents: slice.affisellFeeCents,
    affiliateCommissionCents: slice.affiliateCommissionCents,
    affiliateMarginRetainedCents: slice.affiliateMarginRetainedCents,
    supplierNetCents: slice.supplierNetCents,
    createdAt: order.createdAt.toISOString(),
    shippedAt: order.status === "shipped" ? order.updatedAt.toISOString() : null,
    trackingCarrier: order.trackingCarrier,
    trackingNumber: order.trackingNumber,
    shippingAddressFormatted: formatOrderShippingAddress(order.shippingAddress),
    canMarkShipped: false,
    product: {
      id: first.product.id,
      name: names,
      imageUrl: first.product.images[0] ?? null,
      supplierSku: first.supplierSkuAtOrder || first.product.supplierSku,
    },
    affiliate: {
      id: order.affiliate.id,
      name: order.affiliate.name,
      storeName: store?.name ?? null,
      storeSlug: store?.slug ?? null,
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
  }
}

function marketplaceStatusFilter(tab: "to_ship" | "shipped" | "all") {
  if (tab === "to_ship") return { status: "paid" as const }
  if (tab === "shipped") return { status: "shipped" as const }
  return { status: { in: ["paid", "shipped"] as string[] } }
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
        affiliate: { select: { id: true, name: true, store: { select: { name: true, slug: true } } } },
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
    prisma.order.count({ where: { supplierId, status: "paid" } }),
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
