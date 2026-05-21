import type { PlaceSupplierOrderInput, PlaceSupplierOrderResult } from "@/lib/auto-order/types"

/**
 * AliExpress DS order API wiring is channel-specific — v1 queues manual ops review.
 */
export async function placeAliExpressOrder(
  input: PlaceSupplierOrderInput
): Promise<PlaceSupplierOrderResult> {
  return {
    supplierOrderId: null,
    status: "FAILED",
    errorMessage:
      "AliExpress auto-place not enabled in v1 — ops must fulfill via AliExpress DS console",
    rawRequest: {
      reference: input.reference,
      items: input.group.lines.map((l) => ({
        productId: l.productId,
        qty: l.quantity,
      })),
    },
  }
}
