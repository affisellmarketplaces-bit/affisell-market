import type { SupplierChannelType } from "@prisma/client"

import { BaseSupplierAdapter, type OrderStatusDTO } from "@/lib/suppliers/base.adapter"
import type { InventoryDTO, PlaceOrderDTO, SupplierOrderResult } from "@/lib/suppliers/dto"

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

  async getOrderStatus(_supplierOrderId: string): Promise<OrderStatusDTO> {
    return this.withObservability("manual.getOrderStatus", async () => ({
      status: "PENDING",
      raw: { mode: "manual" },
    }))
  }

  async cancelOrder(_supplierOrderId: string): Promise<void> {
    return this.withObservability("manual.cancelOrder", async () => {})
  }

  async syncInventory(): Promise<InventoryDTO[]> {
    return []
  }
}
