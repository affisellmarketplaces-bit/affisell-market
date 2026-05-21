import type { SupplierChannelType } from "@prisma/client"

import type { PlaceSupplierOrderInput, PlaceSupplierOrderResult } from "@/lib/auto-order/types"
import { placeOrderViaSupplierAdapter } from "@/lib/suppliers/place-order-bridge"
import { supportsSupplierApi } from "@/lib/suppliers/factory"

export type FulfillmentAdapter = {
  placeOrder(input: PlaceSupplierOrderInput): Promise<PlaceSupplierOrderResult>
}

/** @deprecated Prefer `placeOrderViaSupplierAdapter` — kept for legacy imports. */
export function getFulfillmentAdapter(_channel: SupplierChannelType): FulfillmentAdapter {
  return { placeOrder: placeOrderViaSupplierAdapter }
}

export { supportsSupplierApi, placeOrderViaSupplierAdapter }
