import type { SupplierChannelType } from "@prisma/client"

import {
  BaseSupplierAdapter,
  type CancelOrderInput,
  type CancelOrderResult,
  type GetOrderStatusInput,
  type SupplierOrderStatus,
} from "@/lib/suppliers/base.adapter"
import type { InventoryDTO, PlaceOrderDTO, SupplierOrderResult } from "@/lib/suppliers/dto"

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

  async getOrderStatus(input: GetOrderStatusInput): Promise<SupplierOrderStatus> {
    return this.withObservability("manual.getOrderStatus", async () => ({
      status: "PENDING",
      raw: { mode: "manual", supplierOrderId: input.supplierOrderId },
    }))
  }

  async cancelOrder(_input: CancelOrderInput): Promise<CancelOrderResult> {
    return this.withObservability("manual.cancelOrder", async () => ({
      cancelled: false,
    }))
  }

  async syncInventory(): Promise<InventoryDTO[]> {
    return []
  }
}
