import type { Prisma } from "@prisma/client"

import { cancelSupplierFulfillmentJob } from "@/lib/admin/orders/cancel-supplier-job"
import { notifyOrderCancelled } from "@/lib/emails/notify-order-cancelled"
import { prisma } from "@/lib/prisma"

export async function cancelMarketplaceOrderByAdmin(
  orderId: string,
  cancelReason?: string
): Promise<{ ok: boolean; error?: string; emailSent?: boolean }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      supplierFulfillmentLinks: {
        select: { supplierFulfillmentOrderId: true },
      },
    },
  })
  if (!order) return { ok: false, error: "order_not_found" }
  if (order.status === "refunded") {
    return { ok: false, error: "already_refunded" }
  }

  const jobIds = [
    ...new Set(order.supplierFulfillmentLinks.map((l) => l.supplierFulfillmentOrderId)),
  ]

  for (const jobId of jobIds) {
    const result = await cancelSupplierFulfillmentJob(jobId)
    if (!result.ok && result.error !== "not_cancellable") {
      return { ok: false, error: result.error }
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus: "MANUAL_REQUIRED",
      fulfillmentErrors: [{ source: "admin_cancel", reason: cancelReason ?? null }] as Prisma.InputJsonValue,
    },
  })

  const email = await notifyOrderCancelled(orderId, {
    cancelReason: cancelReason ?? "Annulation par l'équipe Affisell",
    markRefunded: true,
  })

  return { ok: true, emailSent: email.sent }
}
