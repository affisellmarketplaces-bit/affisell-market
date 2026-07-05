import "server-only"

import type { AdminOrderTrackingAudit } from "@/lib/admin/orders/types"
import {
  loadOrderTrackingTimeline,
} from "@/lib/order-tracking-event"
import { isSupplierTrackingLocked } from "@/lib/order-tracking-lock.shared"
import { prisma } from "@/lib/prisma"

export type { AdminOrderTrackingAudit } from "@/lib/admin/orders/types"

export async function loadAdminOrderTrackingAudit(
  orderId: string
): Promise<AdminOrderTrackingAudit | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      product: { select: { name: true } },
      supplier: { select: { name: true, email: true } },
      affiliate: { select: { name: true } },
    },
  })
  if (!order) return null

  const timeline = await loadOrderTrackingTimeline(orderId)

  return {
    orderId: order.id,
    generatedAt: new Date().toISOString(),
    status: order.status,
    fulfillmentStatus: order.fulfillmentStatus,
    productName: order.product.name,
    variantLabel: order.variantLabel,
    customerEmail: order.customerEmail,
    supplierName: order.supplier.name ?? order.supplier.email,
    affiliateName: order.affiliate.name,
    trackingCarrier: order.trackingCarrier,
    trackingNumber: order.trackingNumber,
    trackingLocked: isSupplierTrackingLocked({
      trackingLockedAt: order.trackingLockedAt,
      trackingNumber: order.trackingNumber,
      status: order.status,
    }),
    trackingVerifiedBy: order.trackingVerifiedBy,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    deliveredAtSource: order.deliveredAtSource,
    deliveryConfirmedAt: order.deliveryConfirmedAt?.toISOString() ?? null,
    deliveryConfirmedBy: order.deliveryConfirmedBy,
    timeline,
  }
}
