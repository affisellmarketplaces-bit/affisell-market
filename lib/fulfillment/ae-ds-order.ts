/**
 * AliExpress DS place-order — shared with auto-buy + /api/aliexpress/order/create.
 */
export {
  createAliExpressDsOrder,
  placeAliExpressDsOrder,
  type CreateAliExpressDsOrderInput,
  type CreateAliExpressDsOrderResult,
} from "@/lib/aliexpress-ds-create-order"

import type { ShippingAddressPayload } from "@/lib/auto-order/types"

export type AeDsPlaceOrderInput = {
  aeProductId: string
  aeSkuId: string | null
  quantity: number
  shippingAddress: ShippingAddressPayload
}

export type AeDsPlaceOrderResult =
  | { ok: true; aeOrderId: string }
  | { ok: false; error: string }
