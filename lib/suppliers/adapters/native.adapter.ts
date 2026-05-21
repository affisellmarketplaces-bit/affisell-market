import type { SupplierChannelType } from "@prisma/client"

import { BaseSupplierAdapter, type OrderStatusDTO } from "@/lib/suppliers/base.adapter"
import type { InventoryDTO, PlaceOrderDTO, SupplierOrderResult } from "@/lib/suppliers/dto"
import { prisma } from "@/lib/prisma"

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
    return this.withObservability("native.getOrderStatus", async () => {
      const job = await prisma.supplierFulfillmentOrder.findFirst({
        where: { supplierOrderId },
        include: {
          lines: {
            include: { order: { select: { status: true, fulfillmentStatus: true } } },
          },
        },
      })
      const orderStatus = job?.lines[0]?.order?.status
      const fulfillment = job?.lines[0]?.order?.fulfillmentStatus
      let status: OrderStatusDTO["status"] = "CONFIRMED"
      if (orderStatus === "shipped" || fulfillment === "SHIPPED") status = "SHIPPED"
      else if (fulfillment === "DELIVERED") status = "DELIVERED"
      else if (job?.status === "CANCELLED") status = "CANCELLED"
      else if (job?.status === "FAILED") status = "FAILED"
      else if (job?.status === "PENDING") status = "PENDING"

      const line = job?.lines[0]
      return {
        status,
        trackingNumber: line?.trackingNumber ?? undefined,
        trackingUrl: line?.trackingUrl ?? undefined,
        raw: { mode: "native", jobStatus: job?.status, orderStatus, fulfillment },
      }
    })
  }

  async cancelOrder(supplierOrderId: string): Promise<void> {
    return this.withObservability("native.cancelOrder", async () => {
      const job = await prisma.supplierFulfillmentOrder.findFirst({
        where: { supplierOrderId },
      })
      if (!job) return
      await prisma.supplierFulfillmentOrder.update({
        where: { id: job.id },
        data: { status: "CANCELLED", errorMessage: "cancelled_native" },
      })
    })
  }

  async syncInventory(_skus: string[]): Promise<InventoryDTO[]> {
    return this.withObservability("native.syncInventory", async () => [])
  }
}
