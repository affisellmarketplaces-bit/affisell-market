import type { SupplierChannelType } from "@prisma/client"

import { BaseSupplierAdapter } from "@/lib/suppliers/base.adapter"
import type {
  InventoryDTO,
  OrderStatusDTO,
  PlaceOrderDTO,
  SupplierOrderResult,
} from "@/lib/suppliers/dto"

/** Affisell native supplier — no external API; order stays in-platform. */
export class NativeSupplierAdapter extends BaseSupplierAdapter {
  readonly type: SupplierChannelType = "AFFISELL_NATIVE"
  readonly supportsApi = false

  async placeOrder(input: PlaceOrderDTO): Promise<SupplierOrderResult> {
    return this.withObservability("native.placeOrder", async () => {
      const dto = this.parsePlaceOrder(input)
      this.validateAllLineMargins(dto.lines)
      const id = `native-${dto.reference}`
      return {
        supplierOrderId: id,
        status: "CONFIRMED",
        rawRequest: dto,
        rawResponse: { mode: "native", supplierOrderId: id },
      }
    })
  }

  async getOrderStatus(supplierOrderId: string): Promise<OrderStatusDTO> {
    return this.withObservability("native.getOrderStatus", async () => ({
      supplierOrderId,
      status: "CONFIRMED",
    }))
  }

  async cancelOrder(_supplierOrderId: string): Promise<void> {
    return this.withObservability("native.cancelOrder", async () => {})
  }

  async syncInventory(_skus: string[]): Promise<InventoryDTO[]> {
    return this.withObservability("native.syncInventory", async () => [])
  }
}
