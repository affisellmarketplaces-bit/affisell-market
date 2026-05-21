import type { FulfillmentStatus } from "@prisma/client"

import { formatOrderNumber } from "@/lib/admin/orders/list-query"

type OrderWithLinks = {
  id: string
  customerEmail: string
  sellingPriceCents: number
  status: string
  fulfillmentStatus: FulfillmentStatus
  trackingNumber: string | null
  createdAt: Date
  supplierFulfillmentLinks: Array<{
    supplierFulfillmentOrder: {
      provider: { name: string }
    } | null
  }>
}

export type AdminOrderListRow = {
  id: string
  orderNumber: string
  customerEmail: string
  amountCents: number
  paymentStatus: string
  fulfillmentStatus: FulfillmentStatus
  supplierNames: string[]
  trackingNumber: string | null
  createdAt: string
}

export function toAdminOrderListRow(order: OrderWithLinks): AdminOrderListRow {
  const supplierNames = [
    ...new Set(
      order.supplierFulfillmentLinks
        .map((l) => l.supplierFulfillmentOrder?.provider.name)
        .filter((n): n is string => Boolean(n))
    ),
  ]

  return {
    id: order.id,
    orderNumber: formatOrderNumber(order.id),
    customerEmail: order.customerEmail,
    amountCents: order.sellingPriceCents,
    paymentStatus: order.status,
    fulfillmentStatus: order.fulfillmentStatus,
    supplierNames,
    trackingNumber: order.trackingNumber,
    createdAt: order.createdAt.toISOString(),
  }
}
