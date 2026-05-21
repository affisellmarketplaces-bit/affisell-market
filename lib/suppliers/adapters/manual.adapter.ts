import type { SupplierChannelType } from "@prisma/client"

import { BaseSupplierAdapter } from "@/lib/suppliers/base.adapter"
import type {
  InventoryDTO,
  OrderStatusDTO,
  PlaceOrderDTO,
  SupplierOrderResult,
} from "@/lib/suppliers/dto"

/** Manual fulfillment — ops places order outside the API. */
export class ManualSupplierAdapter extends BaseSupplierAdapter {
  readonly type: SupplierChannelType = "MANUAL"
  readonly supportsApi = false

  async placeOrder(input: PlaceOrderDTO): Promise<SupplierOrderResult> {
    return this.withObservability("manual.placeOrder", async () => {
      const dto = this.parsePlaceOrder(input)
      this.validateAllLineMargins(dto.lines)
      return {
        supplierOrderId: null,
        status: "PENDING",
        rawRequest: dto,
        rawResponse: { mode: "manual", requiresOps: true },
      }
    })
  }

  async getOrderStatus(supplierOrderId: string): Promise<OrderStatusDTO> {
    return { supplierOrderId, status: "PENDING" }
  }

  async cancelOrder(): Promise<void> {}

  async syncInventory(): Promise<InventoryDTO[]> {
    return []
  }
}
