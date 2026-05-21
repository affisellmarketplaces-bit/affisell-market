import type { SupplierChannelType } from "@prisma/client"

import { BaseSupplierAdapter, type OrderStatusDTO } from "@/lib/suppliers/base.adapter"
import type { InventoryDTO, PlaceOrderDTO, SupplierOrderResult } from "@/lib/suppliers/dto"

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

  async getOrderStatus(supplierOrderId: string): Promise<OrderStatusDTO> {
    return this.withObservability("aliexpress.getOrderStatus", async () => ({
      status: "PENDING",
      raw: { mode: "aliexpress_manual", supplierOrderId },
    }))
  }

  async cancelOrder(_supplierOrderId: string): Promise<void> {
    return this.withObservability("aliexpress.cancelOrder", async () => {})
  }

  async syncInventory(skus: string[]): Promise<InventoryDTO[]> {
    return skus.map((sku) => ({ sku, stock: 0, available: false }))
  }
}
