import type { PlaceSupplierOrderInput } from "@/lib/auto-order/types"

export type PlaceSupplierOrderJobData = PlaceSupplierOrderInput & {
  supplierFulfillmentOrderId: string
  paymentReference?: string | null
}
