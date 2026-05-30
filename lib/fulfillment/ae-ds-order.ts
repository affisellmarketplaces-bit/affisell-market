import { createAliExpressClient, AliExpressClient } from "@/lib/aliexpress-open-api"
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

function addressJson(addr: ShippingAddressPayload): string {
  return JSON.stringify({
    contact_person: addr.name ?? "Customer",
    mobile_no: addr.phone ?? "",
    country: addr.country ?? "FR",
    province: addr.state ?? "",
    city: addr.city ?? "",
    address: [addr.line1, addr.line2].filter(Boolean).join(", "),
    zip: addr.postal_code ?? "",
  })
}

/** Dropshipping API place order when AliExpress Open API is configured. */
export async function placeAliExpressDsOrder(
  input: AeDsPlaceOrderInput
): Promise<AeDsPlaceOrderResult> {
  if (!AliExpressClient.isConfigured()) {
    return { ok: false, error: "aliexpress_api_not_configured" }
  }

  try {
    const client = await createAliExpressClient()
    const payload = await client.request("aliexpress.ds.order.create", {
      product_id: input.aeProductId,
      product_count: String(Math.max(1, input.quantity)),
      ...(input.aeSkuId ? { sku_attr: input.aeSkuId, sku_id: input.aeSkuId } : {}),
      logistics_address: addressJson(input.shippingAddress),
    })

    const root = payload as Record<string, unknown>
    const response =
      (root.aliexpress_ds_order_create_response as Record<string, unknown> | undefined) ??
      (root as Record<string, unknown>)
    const result = (response?.result ?? response) as Record<string, unknown> | undefined
    const orderId =
      (typeof result?.order_id === "string" && result.order_id) ||
      (typeof result?.orderId === "string" && result.orderId) ||
      (result?.order_id != null ? String(result.order_id) : "")

    if (!orderId) {
      return { ok: false, error: "aliexpress_ds_order_id_missing" }
    }

    return { ok: true, aeOrderId: orderId }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "aliexpress_ds_order_failed",
    }
  }
}
