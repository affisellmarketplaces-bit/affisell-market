import "server-only"

import { buyerOrdersOwnerFilter } from "@/lib/account-orders-payload"
import { buyerVisibleMarketplaceOrderWhere } from "@/lib/buyer-order-visibility"
import { carrierTrackingUrl } from "@/lib/buyer-carrier-tracking"
import { prisma } from "@/lib/prisma"
import {
  storeBuyerOrderStage,
  type StoreBuyerOrderStage,
} from "@/lib/store-buyer-order-status"

export type StoreBuyerOrderRow = {
  id: string
  /** Short human reference shown to the buyer (matches the confirmation e-mail). */
  ref: string
  createdAt: string
  quantity: number
  /** Line total paid (`Order.sellingPriceCents` is already the line amount). */
  totalCents: number
  stage: StoreBuyerOrderStage
  productName: string
  imageUrl: string | null
  trackingCarrier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
}

export function storeBuyerOrderRef(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase()
}

/**
 * Orders a buyer placed through ONE reseller's store (by their account e-mail or buyer user id).
 * Scoped by `affiliateId` so a store never lists purchases made elsewhere on the marketplace.
 */
export async function loadStoreBuyerOrders(args: {
  storeSlug: string
  email: string
  buyerUserId?: string | null
}): Promise<StoreBuyerOrderRow[]> {
  const store = await prisma.store.findUnique({
    where: { slug: args.storeSlug },
    select: { userId: true },
  })
  if (!store) return []

  const orders = await prisma.order.findMany({
    where: {
      affiliateId: store.userId,
      ...buyerOrdersOwnerFilter(args.email.trim().toLowerCase(), args.buyerUserId),
      ...buyerVisibleMarketplaceOrderWhere,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      quantity: true,
      sellingPriceCents: true,
      status: true,
      supplierPreparingAt: true,
      shippedAt: true,
      deliveredAt: true,
      deliveryConfirmedAt: true,
      trackingCarrier: true,
      trackingNumber: true,
      variantImageUrl: true,
      product: { select: { name: true, images: true } },
    },
  })

  return orders.map((o) => ({
    id: o.id,
    ref: storeBuyerOrderRef(o.id),
    createdAt: o.createdAt.toISOString(),
    quantity: o.quantity,
    totalCents: o.sellingPriceCents,
    stage: storeBuyerOrderStage(o),
    productName: o.product.name,
    imageUrl: o.variantImageUrl ?? o.product.images[0] ?? null,
    trackingCarrier: o.trackingCarrier,
    trackingNumber: o.trackingNumber,
    trackingUrl: carrierTrackingUrl(o.trackingCarrier, o.trackingNumber),
  }))
}
