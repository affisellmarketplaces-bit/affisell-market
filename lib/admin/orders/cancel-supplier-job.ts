import type { Prisma } from "@prisma/client"

import { resolveSupplierAdapterForGroup } from "@/lib/suppliers/place-order-bridge"
import { prisma } from "@/lib/prisma"

export async function cancelSupplierFulfillmentJob(
  supplierFulfillmentOrderId: string
): Promise<{ ok: boolean; error?: string }> {
  const job = await prisma.supplierFulfillmentOrder.findUnique({
    where: { id: supplierFulfillmentOrderId },
    include: { lines: true },
  })
  if (!job?.supplierOrderId) {
    return { ok: false, error: "missing_supplier_order_id" }
  }
  if (job.status === "SHIPPED" || job.status === "DELIVERED" || job.status === "CANCELLED") {
    return { ok: false, error: "not_cancellable" }
  }

  try {
    const adapter = await resolveSupplierAdapterForGroup(job.fulfillmentProviderId)
    await adapter.cancelOrder(job.supplierOrderId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes("not_supported") && !msg.includes("manual")) {
      return { ok: false, error: msg }
    }
  }

  await prisma.supplierFulfillmentOrder.update({
    where: { id: job.id },
    data: {
      status: "CANCELLED",
      errorMessage: "cancelled_by_admin",
      processedAt: new Date(),
    },
  })

  for (const line of job.lines) {
    await prisma.order.update({
      where: { id: line.orderId },
      data: {
        fulfillmentStatus: "MANUAL_REQUIRED",
        fulfillmentErrors: [{ supplier: "cancelled_by_admin" }] as Prisma.InputJsonValue,
      },
    })
  }

  return { ok: true }
}
