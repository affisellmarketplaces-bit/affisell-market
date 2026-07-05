import type { Prisma } from "@prisma/client"

import { notifyMarketplaceOrderShipped } from "@/lib/emails/notify-order-shipped"
import { registerPartnerTrackingForCarrierDelivery } from "@/lib/order-carrier-delivery"
import {
  applyOrderStatusToJob,
  mapOrderStatusToFulfillment,
  mapOrderStatusToMarketplaceFulfillment,
} from "@/lib/suppliers/order-status"
import { resolveSupplierAdapterForGroup } from "@/lib/suppliers/place-order-bridge"
import { prisma } from "@/lib/prisma"
import { recordOrderTrackingEvent } from "@/lib/order-tracking-event"
import { trackingLockWriteFields } from "@/lib/order-tracking-lock.shared"

const POLL_STATUSES = ["PENDING", "PROCESSING", "CONFIRMED", "SHIPPED"] as const

export type SyncOrderStatusResult = {
  supplierFulfillmentOrderId: string
  updated: boolean
  status?: string
  trackingNumber?: string
  error?: string
}

export async function syncSupplierFulfillmentOrderStatus(
  supplierFulfillmentOrderId: string
): Promise<SyncOrderStatusResult> {
  const job = await prisma.supplierFulfillmentOrder.findUnique({
    where: { id: supplierFulfillmentOrderId },
    include: {
      lines: {
        include: {
          order: {
            select: {
              id: true,
              customerEmail: true,
              trackingNumber: true,
              trackingLockedAt: true,
              shippedAt: true,
              deliveredAt: true,
              fulfillmentStatus: true,
              product: { select: { name: true } },
            },
          },
        },
      },
      provider: true,
    },
  })
  if (!job?.supplierOrderId) {
    return { supplierFulfillmentOrderId, updated: false, error: "missing_supplier_order_id" }
  }
  if (!POLL_STATUSES.includes(job.status as (typeof POLL_STATUSES)[number])) {
    return { supplierFulfillmentOrderId, updated: false, status: job.status }
  }

  try {
    const adapter = await resolveSupplierAdapterForGroup(job.fulfillmentProviderId)
    const remote = await adapter.getOrderStatus(job.supplierOrderId)
    const { prismaStatus, lineFulfillment } = applyOrderStatusToJob(remote)

    await prisma.supplierFulfillmentOrder.update({
      where: { id: job.id },
      data: {
        status: prismaStatus,
        rawResponse: remote.raw as Prisma.InputJsonValue,
        processedAt: new Date(),
      },
    })

    for (const line of job.lines) {
      const marketplaceOrder = line.order
      const trackingNumber = remote.trackingNumber ?? line.trackingNumber
      const shippedNow =
        remote.status === "SHIPPED" &&
        trackingNumber &&
        !marketplaceOrder.shippedAt &&
        !marketplaceOrder.trackingNumber

      await prisma.supplierFulfillmentOrderLine.update({
        where: { id: line.id },
        data: {
          trackingNumber,
          trackingUrl: remote.trackingUrl ?? line.trackingUrl,
          fulfilledAt:
            remote.status === "SHIPPED" || remote.status === "DELIVERED"
              ? line.fulfilledAt ?? new Date()
              : line.fulfilledAt,
        },
      })
      const orderData: Prisma.OrderUpdateInput = {
        fulfillmentStatus: lineFulfillment,
      }
      if (trackingNumber) orderData.trackingNumber = trackingNumber
      if (remote.carrier) orderData.trackingCarrier = remote.carrier

      if (remote.status === "SHIPPED" || remote.status === "DELIVERED") {
        orderData.status = "shipped"
        orderData.shippedAt = marketplaceOrder.shippedAt ?? new Date()
        orderData.fulfilledAt = new Date()
      }
      if (trackingNumber && !marketplaceOrder.trackingLockedAt) {
        Object.assign(orderData, trackingLockWriteFields("partner"))
      }
      await prisma.order.update({ where: { id: line.orderId }, data: orderData })

      if (trackingNumber && (shippedNow || !marketplaceOrder.trackingNumber)) {
        void registerPartnerTrackingForCarrierDelivery({
          orderId: line.orderId,
          trackingNumber,
          carrier: remote.carrier,
          customerEmail: marketplaceOrder.customerEmail,
        })
      }

      if (shippedNow && trackingNumber) {
        await recordOrderTrackingEvent({
          orderId: line.orderId,
          eventType: "TRACKING_REGISTERED",
          source: "supplier_sync",
          trackingCarrier: remote.carrier,
          trackingNumber,
          fulfillmentStatus: "SHIPPED",
          verificationMethod: "partner",
          payload: { supplierFulfillmentOrderId: job.id, status: remote.status },
        })
      } else if (
        trackingNumber &&
        marketplaceOrder.trackingNumber &&
        marketplaceOrder.trackingNumber !== trackingNumber
      ) {
        await recordOrderTrackingEvent({
          orderId: line.orderId,
          eventType: "TRACKING_UPDATED",
          source: "supplier_sync",
          trackingCarrier: remote.carrier,
          trackingNumber,
          fulfillmentStatus: lineFulfillment,
          verificationMethod: "partner",
          payload: {
            previousTrackingNumber: marketplaceOrder.trackingNumber,
            supplierFulfillmentOrderId: job.id,
          },
        })
      }

      if (shippedNow && marketplaceOrder.customerEmail && trackingNumber) {
        void notifyMarketplaceOrderShipped(marketplaceOrder.id, {
          trackingNumber,
          trackingUrl: remote.trackingUrl ?? line.trackingUrl,
          carrier: remote.carrier,
        })
      }
    }

    return {
      supplierFulfillmentOrderId,
      updated: true,
      status: remote.status,
      trackingNumber: remote.trackingNumber,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { supplierFulfillmentOrderId, updated: false, error: msg }
  }
}

export async function syncAllOpenSupplierOrders(limit = 100): Promise<SyncOrderStatusResult[]> {
  const jobs = await prisma.supplierFulfillmentOrder.findMany({
    where: {
      supplierOrderId: { not: null },
      status: { in: [...POLL_STATUSES] },
      provider: { status: "ACTIVE" },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  })

  const results: SyncOrderStatusResult[] = []
  for (const { id } of jobs) {
    results.push(await syncSupplierFulfillmentOrderStatus(id))
  }
  return results
}

export { mapOrderStatusToFulfillment, mapOrderStatusToMarketplaceFulfillment }
