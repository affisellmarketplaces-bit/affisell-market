import type { Prisma } from "@prisma/client"

import { isSharedAliExpressJob, jobSupplierOrderCoversOrder } from "@/lib/fulfillment/engine-job-attribution"
import { resolveSupplierAdapterForGroup } from "@/lib/suppliers/place-order-bridge"
import { prisma } from "@/lib/prisma"

export type CancelSupplierJobOptions = {
  /**
   * The order whose cancellation / refund triggered this call. An AliExpress job groups several orders but bought only its
   * FIRST line (`lib/fulfillment/engine-job-attribution.ts`): its supplier order id is that one order's purchase. Cancelling
   * it for another order would cancel a valid purchase, and flagging every line of the job would hide that the others were
   * never bought. Pass it whenever the call is made on behalf of ONE order.
   */
  forOrderId?: string
  /** An explicit admin action on the job itself (not on behalf of one order): the whole job is cancelled as before. */
  allowSharedJob?: boolean
}

export async function cancelSupplierFulfillmentJob(
  supplierFulfillmentOrderId: string,
  opts: CancelSupplierJobOptions = {}
): Promise<{ ok: boolean; error?: string }> {
  const job = await prisma.supplierFulfillmentOrder.findUnique({
    where: { id: supplierFulfillmentOrderId },
    include: { lines: { orderBy: { id: "asc" } }, provider: { select: { channelType: true } } },
  })
  if (!job?.supplierOrderId) {
    return { ok: false, error: "missing_supplier_order_id" }
  }
  if (job.status === "SHIPPED" || job.status === "DELIVERED" || job.status === "CANCELLED") {
    return { ok: false, error: "not_cancellable" }
  }

  const attribution = { channelType: job.provider?.channelType ?? null, firstLineOrderId: job.lines[0]?.orderId ?? null }
  const shared = isSharedAliExpressJob({ channelType: attribution.channelType, lineCount: job.lines.length })
  if (shared && !opts.allowSharedJob) {
    // On behalf of ONE order, or by a caller that does not say which: the AliExpress purchase belongs to the first line only.
    // Anything else is "nothing of this order's to cancel here" — `not_cancellable`, which every caller already tolerates.
    if (!opts.forOrderId || !jobSupplierOrderCoversOrder(attribution, opts.forOrderId)) {
      console.log("[cancel-supplier-job]", {
        jobId: job.id,
        forOrderId: opts.forOrderId ?? null,
        result: "shared_job_belongs_to_another_order",
      })
      return { ok: false, error: "not_cancellable" }
    }
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

  // Only the orders this job's purchase really covered are flagged: for a shared AliExpress job that is the first line.
  for (const line of job.lines) {
    if (shared && !opts.allowSharedJob && line.orderId !== attribution.firstLineOrderId) continue
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
