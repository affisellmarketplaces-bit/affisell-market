import type { SupplierFulfillmentStatus } from "@prisma/client"

import type { AdminOrderDetail, AdminSupplierFulfillmentView } from "@/lib/admin/orders/types"
import { extractTrackingFromPartnerPayload } from "@/lib/suppliers/order-status"
import { prisma } from "@/lib/prisma"

const NON_CANCELLABLE: SupplierFulfillmentStatus[] = ["SHIPPED", "DELIVERED", "CANCELLED"]

export async function loadAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      product: { select: { name: true } },
      supplier: { select: { name: true, email: true } },
      affiliate: { select: { name: true } },
      supplierFulfillmentLinks: {
        include: {
          supplierFulfillmentOrder: {
            include: {
              provider: { select: { name: true, channelType: true, metadata: true } },
            },
          },
        },
      },
    },
  })

  if (!order) return null

  const byJob = new Map<string, AdminSupplierFulfillmentView>()

  for (const link of order.supplierFulfillmentLinks) {
    const job = link.supplierFulfillmentOrder
    if (!job) continue

    const existing = byJob.get(job.id)
    const carrier =
      extractTrackingFromPartnerPayload(job.rawResponse).carrier ?? order.trackingCarrier

    const view: AdminSupplierFulfillmentView = {
      id: job.id,
      supplierOrderId: job.supplierOrderId,
      status: job.status,
      trackingNumber: link.trackingNumber ?? order.trackingNumber,
      trackingUrl: link.trackingUrl,
      carrier,
      supplierName: job.provider.name,
      channelType: job.provider.channelType,
      paymentMethod: job.paymentMethod,
      errorMessage: job.errorMessage,
      canCancel: Boolean(job.supplierOrderId) && !NON_CANCELLABLE.includes(job.status),
    }

    if (!existing || (link.trackingNumber && !existing.trackingNumber)) {
      byJob.set(job.id, view)
    }
  }

  return {
    id: order.id,
    status: order.status,
    fulfillmentStatus: order.fulfillmentStatus,
    customerEmail: order.customerEmail,
    quantity: order.quantity,
    sellingPriceCents: order.sellingPriceCents,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    trackingCarrier: order.trackingCarrier,
    trackingNumber: order.trackingNumber,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    productName: order.product.name,
    variantLabel: order.variantLabel,
    supplierName: order.supplier.name ?? order.supplier.email,
    affiliateName: order.affiliate.name,
    stripeSessionId: order.stripeSessionId,
    batchId: order.autoFulfillmentBatchId,
    supplierFulfillmentOrders: [...byJob.values()],
  }
}
