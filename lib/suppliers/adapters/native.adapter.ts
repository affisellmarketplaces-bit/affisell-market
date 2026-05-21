import type { SupplierChannelType } from "@prisma/client"

import {
  BaseSupplierAdapter,
  type CancelOrderInput,
  type CancelOrderResult,
  type GetOrderStatusInput,
  type SupplierOrderStatus,
} from "@/lib/suppliers/base.adapter"
import type { InventoryDTO, PlaceOrderDTO, SupplierOrderResult } from "@/lib/suppliers/dto"
import { prisma } from "@/lib/prisma"

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

  async getOrderStatus(input: GetOrderStatusInput): Promise<SupplierOrderStatus> {
    return this.withObservability("native.getOrderStatus", async () => {
      const job = await prisma.supplierFulfillmentOrder.findFirst({
        where: { supplierOrderId: input.supplierOrderId },
        include: { lines: { include: { order: { select: { status: true, fulfillmentStatus: true } } } } },
      })
      const orderStatus = job?.lines[0]?.order?.status
      const fulfillment = job?.lines[0]?.order?.fulfillmentStatus
      let status: SupplierOrderStatus["status"] = "PROCESSING"
      if (orderStatus === "shipped" || fulfillment === "SHIPPED") status = "SHIPPED"
      else if (fulfillment === "DELIVERED") status = "DELIVERED"
      else if (job?.status === "CANCELLED") status = "CANCELLED"
      else if (job?.status === "FAILED") status = "FAILED"
      else if (job?.status === "CONFIRMED") status = "PROCESSING"

      const line = job?.lines[0]
      return {
        status,
        trackingNumber: line?.trackingNumber ?? undefined,
        trackingUrl: line?.trackingUrl ?? undefined,
        raw: { mode: "native", jobStatus: job?.status, orderStatus, fulfillment },
      }
    })
  }

  async cancelOrder(input: CancelOrderInput): Promise<CancelOrderResult> {
    return this.withObservability("native.cancelOrder", async () => {
      const job = await prisma.supplierFulfillmentOrder.findFirst({
        where: { supplierOrderId: input.supplierOrderId },
      })
      if (!job) return { cancelled: false }
      await prisma.supplierFulfillmentOrder.update({
        where: { id: job.id },
        data: { status: "CANCELLED", errorMessage: input.reason ?? "cancelled_native" },
      })
      return { cancelled: true }
    })
  }

  async syncInventory(_skus: string[]): Promise<InventoryDTO[]> {
    return this.withObservability("native.syncInventory", async () => [])
  }
}
