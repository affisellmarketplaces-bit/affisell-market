import type { FulfillmentStatus, SupplierFulfillmentStatus } from "@prisma/client"

import type { SupplierOrderStatus, SupplierOrderStatusValue } from "@/lib/suppliers/base.adapter"
import type { OrderStatusDTO } from "@/lib/suppliers/dto"

export function mapSupplierOrderStatusToFulfillment(
  status: SupplierOrderStatusValue
): SupplierFulfillmentStatus {
  switch (status) {
    case "PENDING":
      return "PENDING"
    case "PROCESSING":
      return "PROCESSING"
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

export function mapSupplierOrderStatusToMarketplaceFulfillment(
  status: SupplierOrderStatusValue
): FulfillmentStatus {
  switch (status) {
    case "DELIVERED":
      return "DELIVERED"
    case "SHIPPED":
      return "SHIPPED"
    case "CANCELLED":
    case "FAILED":
      return "MANUAL_REQUIRED"
    case "PENDING":
    case "PROCESSING":
      return "PROCESSING"
    default:
      return "ORDERED"
  }
}

export function toOrderStatusDTO(
  supplierOrderId: string,
  status: SupplierOrderStatus
): OrderStatusDTO {
  return {
    supplierOrderId,
    status: mapSupplierOrderStatusToFulfillment(status.status),
    trackingNumber: status.trackingNumber ?? null,
    trackingUrl: status.trackingUrl ?? null,
    raw: status.raw,
  }
}

/** Normalize partner REST payloads into unified status. */
export function parsePartnerOrderStatusPayload(raw: unknown): SupplierOrderStatusValue {
  if (!raw || typeof raw !== "object") return "PROCESSING"
  const o = raw as Record<string, unknown>
  const s = String(o.status ?? o.state ?? o.fulfillment_status ?? "processing").toLowerCase()
  if (s.includes("deliver")) return "DELIVERED"
  if (s.includes("ship") || s.includes("transit")) return "SHIPPED"
  if (s.includes("cancel")) return "CANCELLED"
  if (s.includes("fail") || s.includes("error")) return "FAILED"
  if (s.includes("pending") || s.includes("queue")) return "PENDING"
  return "PROCESSING"
}

export function extractTrackingFromPartnerPayload(raw: unknown): {
  trackingNumber?: string
  trackingUrl?: string
  estimatedDelivery?: Date
} {
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
  let estimatedDelivery: Date | undefined
  const eta = o.estimated_delivery ?? o.estimatedDelivery
  if (typeof eta === "string" || typeof eta === "number") {
    const d = new Date(eta)
    if (!Number.isNaN(d.getTime())) estimatedDelivery = d
  }
  return { trackingNumber, trackingUrl, estimatedDelivery }
}
