import type { ChinaBuyRouteStatus } from "@prisma/client"

/** Map Superbuy / Anovabuy webhook status strings to internal route status. */
export function mapChinaBuyWebhookStatus(raw: string): ChinaBuyRouteStatus | null {
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (
    s === "stub" ||
    s === "pending" ||
    s === "processing" ||
    s === "ordered" ||
    s === "submitted" ||
    s === "routed"
  ) {
    return "ROUTED"
  }
  if (
    s === "api_ok" ||
    s === "ok" ||
    s === "success" ||
    s === "purchased" ||
    s === "confirmed" ||
    s === "paid" ||
    s === "shipped" ||
    s === "delivered"
  ) {
    return "API_OK"
  }
  if (
    s === "api_fail" ||
    s === "fail" ||
    s === "failed" ||
    s === "error" ||
    s === "cancelled" ||
    s === "canceled" ||
    s === "refunded"
  ) {
    return "API_FAIL"
  }
  return null
}
