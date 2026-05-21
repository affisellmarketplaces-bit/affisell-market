import type { SupplierChannelType } from "@prisma/client"

import {
  BaseSupplierAdapter,
  type CancelOrderInput,
  type CancelOrderResult,
  type GetOrderStatusInput,
  type SupplierOrderStatus,
} from "@/lib/suppliers/base.adapter"
import type { InventoryDTO, PlaceOrderDTO, SupplierOrderResult } from "@/lib/suppliers/dto"

/**
 * AliExpress — API placement not wired in v1.1; queues manual ops with margin checks.
 */
export class AliExpressSupplierAdapter extends BaseSupplierAdapter {
  readonly type: SupplierChannelType = "ALIEXPRESS"
  readonly supportsApi = false

  async placeOrder(input: PlaceOrderDTO): Promise<SupplierOrderResult> {
    return this.withObservability("aliexpress.placeOrder", async () => {
      const dto = this.parsePlaceOrder(input)
      this.validateAllLineMargins(dto.lines)
      return {
        supplierOrderId: null,
        status: "PENDING",
        rawRequest: dto,
        rawResponse: { mode: "aliexpress_manual", message: "Auto API pending — manual queue" },
      }
    })
  }

  async getOrderStatus(input: GetOrderStatusInput): Promise<SupplierOrderStatus> {
    return this.withObservability("aliexpress.getOrderStatus", async () => ({
      status: "PENDING",
      raw: { mode: "aliexpress_manual", supplierOrderId: input.supplierOrderId },
    }))
  }

  async cancelOrder(_input: CancelOrderInput): Promise<CancelOrderResult> {
    return this.withObservability("aliexpress.cancelOrder", async () => ({
      cancelled: false,
    }))
  }

  async syncInventory(skus: string[]): Promise<InventoryDTO[]> {
    return skus.map((sku) => ({ sku, stock: 0, available: false }))
  }
}
