import type { PlaceSupplierOrderInput, PlaceSupplierOrderResult } from "@/lib/auto-order/types"
import { enqueuePlaceSupplierOrderJob } from "@/lib/auto-order/bullmq/place-order.queue"
import { isAutoOrderQueueEnabled } from "@/lib/auto-order/redis"
import { loadIdempotentPlaceOrderResult } from "@/lib/suppliers/place-order-idempotency"
import { placeOrderViaSupplierAdapter } from "@/lib/suppliers/place-order-bridge"

export type PlaceOrderDispatchResult = PlaceSupplierOrderResult & {
  /** Job handed off to BullMQ — batch finalization runs in the worker. */
  deferred?: boolean
}

export type ResilientPlaceOrderArgs = PlaceSupplierOrderInput & {
  supplierFulfillmentOrderId: string
  paymentReference?: string | null
}

/**
 * Idempotent place-order entry: DB short-circuit → BullMQ (retry + DLQ) or inline fallback.
 */
export async function dispatchPlaceSupplierOrder(
  args: ResilientPlaceOrderArgs
): Promise<PlaceOrderDispatchResult> {
  const cached = await loadIdempotentPlaceOrderResult(args.supplierFulfillmentOrderId)
  if (cached) return cached

  if (isAutoOrderQueueEnabled()) {
    await enqueuePlaceSupplierOrderJob({
      supplierFulfillmentOrderId: args.supplierFulfillmentOrderId,
      batchId: args.batchId,
      reference: args.reference,
      shipping: args.shipping,
      contactEmail: args.contactEmail,
      group: args.group,
      paymentReference: args.paymentReference,
    })
    return { supplierOrderId: null, status: "PROCESSING", deferred: true }
  }

  return placeOrderViaSupplierAdapter(args)
}
