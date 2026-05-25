import { describe, expect, it } from "vitest"

import {
  buildShipPulseSnapshot,
  computeShipDeadlineAt,
  resolveShipDeadlineAt,
  SUPPLIER_SHIP_SLA_MS,
} from "@/lib/supplier-ship-sla-shared"

describe("computeShipDeadlineAt", () => {
  it("adds 10 days to payment anchor", () => {
    const paid = new Date("2026-01-01T12:00:00Z")
    const deadline = computeShipDeadlineAt(paid)
    expect(deadline.getTime() - paid.getTime()).toBe(SUPPLIER_SHIP_SLA_MS)
  })
})

describe("buildShipPulseSnapshot", () => {
  it("marks breached when past deadline", () => {
    const deadline = new Date("2026-01-01T00:00:00Z")
    const snap = buildShipPulseSnapshot(deadline, deadline.getTime() + 60_000)
    expect(snap.phase).toBe("breached")
    expect(snap.msRemaining).toBeLessThanOrEqual(0)
  })

  it("marks critical under 6h", () => {
    const now = Date.parse("2026-01-01T00:00:00Z")
    const deadline = new Date(now + 5 * 3_600_000)
    const snap = buildShipPulseSnapshot(deadline, now)
    expect(snap.phase).toBe("critical")
  })
})

describe("resolveShipDeadlineAt", () => {
  it("prefers stored shipDeadlineAt", () => {
    const stored = new Date("2026-06-01T00:00:00Z")
    expect(
      resolveShipDeadlineAt({
        shipDeadlineAt: stored,
        paidAt: new Date("2026-01-01T00:00:00Z"),
        createdAt: new Date("2025-01-01T00:00:00Z"),
      })
    ).toEqual(stored)
  })
})
