import { placeOrderViaSupplierAdapter } from "@/lib/suppliers/place-order-bridge"
import { isNonRetryablePlaceOrderError, NonRetryablePlaceOrderError } from "@/lib/suppliers/place-order-errors"
import { loadIdempotentPlaceOrderResult } from "@/lib/suppliers/place-order-idempotency"
import { MarginTooLowError } from "@/lib/suppliers/base.adapter"
import { applySupplierPlaceOrderResult } from "@/lib/auto-order/apply-place-result"
import { finalizeAutoFulfillmentBatch } from "@/lib/auto-order/batch-finalize"
import { logAutoOrder } from "@/lib/auto-order/telemetry"
import type { PlaceSupplierOrderJobData } from "@/lib/auto-order/bullmq/place-order.types"

export async function processPlaceSupplierOrderJob(
  data: PlaceSupplierOrderJobData
): Promise<void> {
  const { supplierFulfillmentOrderId, batchId, paymentReference, ...rest } = data
  const input = { ...rest, batchId }

  const cached = await loadIdempotentPlaceOrderResult(supplierFulfillmentOrderId)
  if (cached) {
    logAutoOrder("place_order_idempotent_skip", { supplierFulfillmentOrderId })
    await applySupplierPlaceOrderResult({
      supplierFulfillmentOrderId,
      batchId,
      providerId: input.group.providerId,
      group: input.group,
      placed: cached,
      paymentReference,
    })
    await finalizeAutoFulfillmentBatch(batchId)
    return
  }

  let placed
  try {
    placed = await placeOrderViaSupplierAdapter(input)
  } catch (e) {
    if (e instanceof MarginTooLowError || isNonRetryablePlaceOrderError(e)) {
      placed = {
        supplierOrderId: null,
        status: "FAILED" as const,
        errorMessage: e instanceof Error ? e.message : String(e),
      }
    } else {
      throw e
    }
  }

  if (placed.status === "FAILED" && placed.errorMessage && isNonRetryablePlaceOrderError(new Error(placed.errorMessage))) {
    await applySupplierPlaceOrderResult({
      supplierFulfillmentOrderId,
      batchId,
      providerId: input.group.providerId,
      group: input.group,
      placed,
      paymentReference,
    })
    await finalizeAutoFulfillmentBatch(batchId)
    throw new NonRetryablePlaceOrderError(placed.errorMessage)
  }

  await applySupplierPlaceOrderResult({
    supplierFulfillmentOrderId,
    batchId,
    providerId: input.group.providerId,
    group: input.group,
    placed,
    paymentReference,
  })

  await finalizeAutoFulfillmentBatch(batchId)
}
