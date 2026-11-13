import type { FulfillmentStatus, Prisma } from "@prisma/client"

import type { PlaceSupplierOrderResult } from "@/lib/auto-order/types"
import type { SupplierGroup } from "@/lib/auto-order/types"
import { recordCircuitFailure, recordCircuitSuccess } from "@/lib/auto-order/circuit-breaker"
import { prisma } from "@/lib/prisma"

export type ApplyPlaceResultOutcome = {
  success: boolean
  lineStatus: FulfillmentStatus
  errorMessage?: string
}

export async function applySupplierPlaceOrderResult(args: {
  supplierFulfillmentOrderId: string
  batchId: string
  providerId: string
  group: SupplierGroup
  placed: PlaceSupplierOrderResult
  paymentReference?: string | null
}): Promise<ApplyPlaceResultOutcome> {
  const { supplierFulfillmentOrderId, batchId: _batchId, providerId, group, placed, paymentReference } = args
  const circuitKey = `provider:${providerId}`

  await prisma.supplierFulfillmentOrder.update({
    where: { id: supplierFulfillmentOrderId },
    data: {
      status: placed.status,
      supplierOrderId: placed.supplierOrderId,
      paymentReference: paymentReference ?? null,
      rawRequest: placed.rawRequest as Prisma.InputJsonValue,
      rawResponse: placed.rawResponse as Prisma.InputJsonValue,
      errorMessage: placed.errorMessage,
      processedAt: new Date(),
      attempts: { increment: 1 },
    },
  })

  // CANCELLED = this job did not start a purchase (the per-order gate found it already bought / in flight / no longer
  // purchasable): it is recorded on the job only. Writing a line status here could overwrite the ORDERED state that the
  // path which really bought has just recorded, and a refused duplicate says nothing about the provider's health.
  if (placed.status === "CANCELLED") {
    return { success: false, lineStatus: "PROCESSING", errorMessage: placed.errorMessage }
  }

  const lineStatus: FulfillmentStatus =
    placed.status === "CONFIRMED" || placed.status === "SHIPPED"
      ? "ORDERED"
      : placed.status === "FAILED"
        ? "MANUAL_REQUIRED"
        : "PROCESSING"

  // An AliExpress job buys only its FIRST line (`engine-job-attribution.ts`). The other lines of the group were not bought: they
  // must not be marked ORDERED (that would make their payout gate read "upstream funded"); they are flagged so that someone —
  // or the `order.paid` / auto-buy path, each under its own claim — buys them. A FAILED job flags every line, as before.
  const purchasedOnly = group.channel === "ALIEXPRESS" && placed.status !== "FAILED"

  for (const [index, l] of group.lines.entries()) {
    if (purchasedOnly && index > 0) {
      await prisma.order.update({
        where: { id: l.orderId },
        data: {
          fulfillmentStatus: "MANUAL_REQUIRED",
          fulfillmentErrors: [{ supplier: "ae_group_line_not_purchased" }] as Prisma.InputJsonValue,
        },
      })
      continue
    }
    await prisma.order.update({
      where: { id: l.orderId },
      data: {
        fulfillmentStatus: lineStatus,
        fulfilledAt: lineStatus === "ORDERED" ? new Date() : null,
        fulfillmentErrors: placed.errorMessage
          ? ([{ supplier: placed.errorMessage }] as Prisma.InputJsonValue)
          : undefined,
      },
    })
  }

  const success = placed.status === "CONFIRMED" || placed.status === "SHIPPED"
  if (success) {
    recordCircuitSuccess(circuitKey)
  } else if (placed.status === "FAILED" && !placed.errorMessage?.startsWith("margin_refused")) {
    recordCircuitFailure(circuitKey)
  }

  return { success, lineStatus, errorMessage: placed.errorMessage }
}
