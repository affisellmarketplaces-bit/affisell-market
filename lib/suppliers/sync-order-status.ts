import type { Prisma } from "@prisma/client"

import {
  applyOrderStatusToJob,
  mapOrderStatusToFulfillment,
  mapOrderStatusToMarketplaceFulfillment,
} from "@/lib/suppliers/order-status"
import { resolveSupplierAdapterForGroup } from "@/lib/suppliers/place-order-bridge"
import { prisma } from "@/lib/prisma"

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
    include: { lines: true, provider: true },
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
      await prisma.supplierFulfillmentOrderLine.update({
        where: { id: line.id },
        data: {
          trackingNumber: remote.trackingNumber ?? line.trackingNumber,
          trackingUrl: remote.trackingUrl ?? line.trackingUrl,
          fulfilledAt:
            remote.status === "SHIPPED" || remote.status === "DELIVERED"
              ? line.fulfilledAt ?? new Date()
              : line.fulfilledAt,
        },
      })
      await prisma.order.update({
        where: { id: line.orderId },
        data: {
          fulfillmentStatus: lineFulfillment,
          fulfilledAt:
            lineFulfillment === "SHIPPED" || lineFulfillment === "DELIVERED" ? new Date() : null,
        },
      })
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
