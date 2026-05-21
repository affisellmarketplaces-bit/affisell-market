import type { FulfillmentStatus, SupplierFulfillmentStatus } from "@prisma/client"

import type { OrderStatusDTO } from "@/lib/suppliers/base.adapter"

export type AdapterOrderStatus = OrderStatusDTO["status"]

export function mapOrderStatusToFulfillment(status: AdapterOrderStatus): SupplierFulfillmentStatus {
  switch (status) {
    case "PENDING":
      return "PENDING"
    case "CONFIRMED":
      return "CONFIRMED"
    case "SHIPPED":
      return "SHIPPED"
    case "DELIVERED":
      return "DELIVERED"
    case "CANCELLED":
      return "CANCELLED"
    case "FAILED":
      return "FAILED"
    default:
      return "PROCESSING"
  }
}

export function mapOrderStatusToMarketplaceFulfillment(status: AdapterOrderStatus): FulfillmentStatus {
  switch (status) {
    case "DELIVERED":
      return "DELIVERED"
    case "SHIPPED":
      return "SHIPPED"
    case "CANCELLED":
    case "FAILED":
      return "MANUAL_REQUIRED"
    case "PENDING":
    case "CONFIRMED":
      return "PROCESSING"
    default:
      return "ORDERED"
  }
}

/** Normalize partner REST payloads into unified adapter status. */
export function parsePartnerOrderStatusPayload(raw: unknown): AdapterOrderStatus {
  if (!raw || typeof raw !== "object") return "CONFIRMED"
  const o = raw as Record<string, unknown>
  const s = String(o.status ?? o.state ?? o.fulfillment_status ?? "confirmed").toLowerCase()
  if (s.includes("deliver")) return "DELIVERED"
  if (s.includes("ship") || s.includes("transit")) return "SHIPPED"
  if (s.includes("cancel")) return "CANCELLED"
  if (s.includes("fail") || s.includes("error")) return "FAILED"
  if (s.includes("pending") || s.includes("queue")) return "PENDING"
  if (s.includes("confirm") || s.includes("process")) return "CONFIRMED"
  return "CONFIRMED"
}

export function extractTrackingFromPartnerPayload(raw: unknown): Pick<
  OrderStatusDTO,
  "trackingNumber" | "trackingUrl" | "carrier" | "estimatedDelivery"
> {
  if (!raw || typeof raw !== "object") return {}
  const o = raw as Record<string, unknown>
  const trackingNumber =
    typeof o.tracking_number === "string"
      ? o.tracking_number
      : typeof o.trackingNumber === "string"
        ? o.trackingNumber
        : undefined
  const trackingUrl =
    typeof o.tracking_url === "string"
      ? o.tracking_url
      : typeof o.trackingUrl === "string"
        ? o.trackingUrl
        : undefined
  const carrier =
    typeof o.carrier === "string"
      ? o.carrier
      : typeof o.shipping_carrier === "string"
        ? o.shipping_carrier
        : undefined
  let estimatedDelivery: Date | undefined
  const eta = o.estimated_delivery ?? o.estimatedDelivery
  if (typeof eta === "string" || typeof eta === "number") {
    const d = new Date(eta)
    if (!Number.isNaN(d.getTime())) estimatedDelivery = d
  }
  return { trackingNumber, trackingUrl, carrier, estimatedDelivery }
}

export function applyOrderStatusToJob(orderStatus: OrderStatusDTO): {
  prismaStatus: SupplierFulfillmentStatus
  lineFulfillment: FulfillmentStatus
} {
  const prismaStatus = mapOrderStatusToFulfillment(orderStatus.status)
  const lineFulfillment = mapOrderStatusToMarketplaceFulfillment(orderStatus.status)
  return { prismaStatus, lineFulfillment }
}
