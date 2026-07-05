import { describe, expect, it } from "vitest"

import {
  formatTrackingAuditTimestamp,
  trackingAuditDeliveredAtSourceLabel,
  trackingAuditEventLabel,
  trackingAuditSourceLabel,
} from "@/lib/admin/orders/tracking-audit-labels.shared"

describe("tracking-audit-labels", () => {
  it("maps known event types", () => {
    expect(trackingAuditEventLabel("DELIVERED")).toBe("Livré (transporteur)")
    expect(trackingAuditSourceLabel("aftership_webhook")).toBe("Webhook AfterShip")
  })

  it("maps deliveredAt sources", () => {
    expect(trackingAuditDeliveredAtSourceLabel("aftership_webhook")).toContain("AfterShip")
    expect(trackingAuditDeliveredAtSourceLabel(null)).toBe("—")
  })

  it("formats UTC timestamps", () => {
    const label = formatTrackingAuditTimestamp("2026-07-05T10:30:00.000Z")
    expect(label).toMatch(/2026/)
    expect(label).toMatch(/10:30/)
  })
})
