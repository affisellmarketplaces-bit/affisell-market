import type { FulfillmentStatus, SupplierFulfillmentStatus } from "@prisma/client"

export type AdminSupplierFulfillmentView = {
  id: string
  supplierOrderId: string | null
  status: SupplierFulfillmentStatus
  trackingNumber: string | null
  trackingUrl: string | null
  carrier: string | null
  supplierName: string
  channelType: string
  paymentMethod: string
  errorMessage: string | null
  canCancel: boolean
}

export type AdminOrderDetail = {
  id: string
  status: string
  fulfillmentStatus: FulfillmentStatus
  customerEmail: string
  quantity: number
  sellingPriceCents: number
  createdAt: string
  paidAt: string | null
  trackingCarrier: string | null
  trackingNumber: string | null
  shippedAt: string | null
  productName: string
  variantLabel: string | null
  supplierName: string
  affiliateName: string | null
  stripeSessionId: string
  batchId: string | null
  supplierFulfillmentOrders: AdminSupplierFulfillmentView[]
}
