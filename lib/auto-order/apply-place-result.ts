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

  const lineStatus: FulfillmentStatus =
    placed.status === "CONFIRMED" || placed.status === "SHIPPED"
      ? "ORDERED"
      : placed.status === "FAILED"
        ? "MANUAL_REQUIRED"
        : "PROCESSING"

  for (const l of group.lines) {
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
  } else if (placed.status === "FAILED") {
    recordCircuitFailure(circuitKey)
  }

  return { success, lineStatus, errorMessage: placed.errorMessage }
}
