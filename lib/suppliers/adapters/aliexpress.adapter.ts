import type { SupplierChannelType } from "@prisma/client"

import { BaseSupplierAdapter } from "@/lib/suppliers/base.adapter"
import type {
  InventoryDTO,
  OrderStatusDTO,
  PlaceOrderDTO,
  SupplierOrderResult,
} from "@/lib/suppliers/dto"

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

  async getOrderStatus(supplierOrderId: string): Promise<OrderStatusDTO> {
    return { supplierOrderId, status: "PENDING" }
  }

  async cancelOrder(): Promise<void> {}

  async syncInventory(skus: string[]): Promise<InventoryDTO[]> {
    return skus.map((sku) => ({ sku, stock: 0, available: false }))
  }
}
