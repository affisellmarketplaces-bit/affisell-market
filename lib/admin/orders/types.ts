import type { FulfillmentStatus, SupplierFulfillmentStatus } from "@prisma/client"

import type { OrderTrackingTimelineItem } from "@/lib/order-tracking-event"

export type AdminOrderTrackingAudit = {
  orderId: string
  generatedAt: string
  status: string
  fulfillmentStatus: string
  productName: string
  variantLabel: string | null
  customerEmail: string
  supplierName: string
  affiliateName: string | null
  trackingCarrier: string | null
  trackingNumber: string | null
  trackingLocked: boolean
  trackingVerifiedBy: string | null
  shippedAt: string | null
  deliveredAt: string | null
  deliveredAtSource: string | null
  deliveryConfirmedAt: string | null
  deliveryConfirmedBy: string | null
  timeline: OrderTrackingTimelineItem[]
}

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
  autodsOrderId: string | null
  autodsStatus: string | null
  autodsTracking: string | null
  autodsTrackingUrl: string | null
  autodsCarrier: string | null
  supplierFulfillmentOrders: AdminSupplierFulfillmentView[]
}
