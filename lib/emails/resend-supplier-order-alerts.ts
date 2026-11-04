import { dispatchMerchantOrderAlerts } from "@/lib/emails/dispatch-merchant-order-alerts"
import { prisma } from "@/lib/prisma"

export type ResendSupplierOrderAlertsResult = {
  scanned: number
  attempted: number
  forced: boolean
  hours: number
  orderIds: string[]
}

/**
 * Re-dispatch supplier "new order" emails for recent paid marketplace orders.
 * - Default: only orders still missing merchantSupplierEmailSentAt
 * - force=true: clear the flag and send again (ops heal when Resend accepted but inbox never got it)
 */
export async function resendSupplierOrderAlerts(args?: {
  hours?: number
  force?: boolean
  limit?: number
  supplierEmail?: string
}): Promise<ResendSupplierOrderAlertsResult> {
  const hours = Math.min(168, Math.max(1, Math.round(args?.hours ?? 48)))
  const limit = Math.min(100, Math.max(1, Math.round(args?.limit ?? 40)))
  const force = args?.force === true
  const since = new Date(Date.now() - hours * 3_600_000)

  const supplierEmail = args?.supplierEmail?.trim().toLowerCase()

  const orders = await prisma.order.findMany({
    where: {
      status: "paid",
      paidAt: { gte: since },
      ...(force ? {} : { merchantSupplierEmailSentAt: null }),
      ...(supplierEmail
        ? { supplier: { email: { equals: supplierEmail, mode: "insensitive" } } }
        : {}),
    },
    orderBy: { paidAt: "desc" },
    take: limit,
    select: { id: true },
  })

  const orderIds = orders.map((o) => o.id)
  for (const id of orderIds) {
    await dispatchMerchantOrderAlerts(id, { forceSupplier: force })
  }

  console.log("[resend-supplier-order-alerts]", {
    result: "done",
    scanned: orderIds.length,
    attempted: orderIds.length,
    forced: force,
    hours,
  })

  return {
    scanned: orderIds.length,
    attempted: orderIds.length,
    forced: force,
    hours,
    orderIds,
  }
}
