import type { PlaceSupplierOrderInput, PlaceSupplierOrderResult } from "@/lib/auto-order/types"

/**
 * Native Affisell suppliers fulfill via dashboard — no external API purchase.
 * Marks job CONFIRMED; supplier already notified by marketplace order flow.
 */
export async function placeNativeOrder(
  input: PlaceSupplierOrderInput
): Promise<PlaceSupplierOrderResult> {
  return {
    supplierOrderId: `native-${input.batchId}-${input.group.providerId}`,
    status: "CONFIRMED",
    rawRequest: { mode: "AFFISELL_NATIVE", lineCount: input.group.lines.length },
    rawResponse: { message: "Supplier notified via Affisell dashboard" },
  }
}
