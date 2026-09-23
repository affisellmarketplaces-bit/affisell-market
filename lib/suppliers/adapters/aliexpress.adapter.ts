import type { SupplierChannelType } from "@prisma/client"

import { placeAliExpressDsOrder } from "@/lib/fulfillment/ae-ds-order"
import { BaseSupplierAdapter, type OrderStatusDTO } from "@/lib/suppliers/base.adapter"
import type { InventoryDTO, PlaceOrderDTO, SupplierOrderResult } from "@/lib/suppliers/dto"
import { summarizeAddressForLog } from "@/lib/aliexpress-mapping"

export class AliExpressSupplierAdapter extends BaseSupplierAdapter {
  readonly type: SupplierChannelType = "ALIEXPRESS"
  readonly supportsApi = true

  async placeOrder(input: PlaceOrderDTO): Promise<SupplierOrderResult> {
    return this.withObservability("aliexpress.placeOrder", async () => {
      const dto = this.parsePlaceOrder(input)
      this.validateAllLineMargins(dto.lines)

      const line = dto.lines[0]
      if (!line) {
        return {
          supplierOrderId: null,
          status: "FAILED",
          errorMessage: "empty_lines",
          rawRequest: dto,
        }
      }

      const aeProductId = (line.productId ?? line.sku).trim()
      const aeSkuId = line.sku.trim()
      const shipping = {
        name: dto.shipping.name,
        line1: dto.shipping.line1,
        line2: dto.shipping.line2,
        city: dto.shipping.city,
        state: dto.shipping.state,
        postal_code: dto.shipping.postal_code ?? dto.shipping.postalCode,
        country: dto.shipping.country,
        phone: dto.shipping.phone,
      }

      console.log("[aliexpress-adapter]", {
        result: "place",
        reference: dto.reference,
        aeProductId,
        ...summarizeAddressForLog({
          city: shipping.city,
          zip: shipping.postal_code,
          country: shipping.country,
        }),
      })

      const placed = await placeAliExpressDsOrder({
        aeProductId,
        aeSkuId,
        quantity: line.quantity,
        shippingAddress: shipping,
      })

      if (!placed.ok) {
        return {
          supplierOrderId: null,
          status: "FAILED",
          errorMessage: placed.error,
          rawRequest: { aeProductId, aeSkuId, quantity: line.quantity },
          rawResponse: { error: placed.error },
        }
      }

      return {
        supplierOrderId: placed.aeOrderId,
        status: "PROCESSING",
        rawRequest: { aeProductId, aeSkuId, quantity: line.quantity },
        rawResponse: { aeOrderId: placed.aeOrderId },
      }
    })
  }

  async getOrderStatus(supplierOrderId: string): Promise<OrderStatusDTO> {
    return this.withObservability("aliexpress.getOrderStatus", async () => ({
      status: "CONFIRMED",
      raw: { mode: "aliexpress_ds", supplierOrderId },
    }))
  }

  /**
   * No AliExpress cancel/after-sales API is wired here — this used to silently resolve as if
   * cancellation had succeeded, which is wrong (callers took that as confirmation nothing was
   * charged). Throwing lets callers (e.g. cancelSupplierFulfillmentJob) correctly treat this as
   * "needs manual cancellation," matching the convention BaseSupplierAdapter callers expect.
   */
  async cancelOrder(_supplierOrderId: string): Promise<void> {
    return this.withObservability("aliexpress.cancelOrder", async () => {
      throw new Error("not_supported: aliexpress_cancel_no_api")
    })
  }

  async syncInventory(skus: string[]): Promise<InventoryDTO[]> {
    return skus.map((sku) => ({ sku, stock: 0, available: false }))
  }
}
