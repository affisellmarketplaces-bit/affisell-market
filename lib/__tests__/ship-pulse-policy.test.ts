import { describe, expect, it } from "vitest"

import { evaluateShipPulseAutoCancel } from "@/lib/orders/ship-pulse-policy"
import { SHIP_EXTENSION_SUPPLIER_GRACE_MS } from "@/lib/supplier-ship-sla-shared"

describe("evaluateShipPulseAutoCancel", () => {
  const deadline = new Date("2026-01-11T00:00:00Z")

  it("blocks when tracking exists", () => {
    const d = evaluateShipPulseAutoCancel({
      now: new Date("2026-01-12T00:00:00Z"),
      deadline,
      trackingNumber: "1Z999",
      supplierMessageCount: 0,
      extensions: [],
    })
    expect(d.eligible).toBe(false)
    expect(d.reason).toBe("has_tracking")
  })

  it("blocks during supplier grace without engagement", () => {
    const d = evaluateShipPulseAutoCancel({
      now: new Date(deadline.getTime() + SHIP_EXTENSION_SUPPLIER_GRACE_MS - 60_000),
      deadline,
      trackingNumber: null,
      supplierMessageCount: 0,
      extensions: [],
    })
    expect(d.eligible).toBe(false)
    expect(d.reason).toBe("supplier_grace")
  })

  it("allows cancel when extension rejected", () => {
    const d = evaluateShipPulseAutoCancel({
      now: new Date("2026-01-20T00:00:00Z"),
      deadline,
      trackingNumber: null,
      supplierMessageCount: 2,
      extensions: [
        {
          status: "REJECTED",
          buyerExpiresAt: new Date("2026-01-15T00:00:00Z"),
          newDeadlineAt: null,
          createdAt: new Date("2026-01-12T00:00:00Z"),
        },
      ],
    })
    expect(d.eligible).toBe(true)
    expect(d.reason).toBe("extension_rejected")
  })

  it("blocks while buyer has pending extension", () => {
    const d = evaluateShipPulseAutoCancel({
      now: new Date("2026-01-12T00:00:00Z"),
      deadline,
      trackingNumber: null,
      supplierMessageCount: 1,
      extensions: [
        {
          status: "PENDING",
          buyerExpiresAt: new Date("2026-01-15T00:00:00Z"),
          newDeadlineAt: null,
          createdAt: new Date("2026-01-11T01:00:00Z"),
        },
      ],
    })
    expect(d.eligible).toBe(false)
    expect(d.reason).toBe("pending_extension")
  })
})
