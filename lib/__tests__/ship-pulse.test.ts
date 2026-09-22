import { describe, expect, it } from "vitest"

import {
  buildShipPulseSnapshot,
  computeShipDeadlineAt,
  computeShipDeadlineAtForRoute,
  isShipDeadlineBreached,
  resolveShipDeadlineAt,
  SHIP_HANDLING_DAYS_DOMESTIC,
  SHIP_HANDLING_DAYS_EUROPE,
  SHIP_HANDLING_DAYS_INTERNATIONAL,
  shipHandlingDaysForRoute,
  SUPPLIER_SHIP_SLA_MS,
} from "@/lib/supplier-ship-sla-shared"

describe("computeShipDeadlineAt", () => {
  it("adds 10 days to payment anchor", () => {
    const paid = new Date("2026-01-01T12:00:00Z")
    const deadline = computeShipDeadlineAt(paid)
    expect(deadline.getTime() - paid.getTime()).toBe(SUPPLIER_SHIP_SLA_MS)
  })
})

describe("shipHandlingDaysForRoute", () => {
  it("gives a domestic route the shortest window", () => {
    expect(shipHandlingDaysForRoute("FR", "FR")).toBe(SHIP_HANDLING_DAYS_DOMESTIC)
    expect(shipHandlingDaysForRoute("DE", "DE")).toBe(SHIP_HANDLING_DAYS_DOMESTIC)
  })

  it("keeps today's 10-day window for cross-border Europe — the common case, unchanged", () => {
    expect(shipHandlingDaysForRoute("FR", "DE")).toBe(SHIP_HANDLING_DAYS_EUROPE)
    expect(shipHandlingDaysForRoute("FR", "PL")).toBe(SHIP_HANDLING_DAYS_EUROPE)
    expect(SHIP_HANDLING_DAYS_EUROPE).toBe(10)
  })

  it("gives destinations outside Europe more time, never less", () => {
    expect(shipHandlingDaysForRoute("FR", "US")).toBe(SHIP_HANDLING_DAYS_INTERNATIONAL)
    expect(SHIP_HANDLING_DAYS_INTERNATIONAL).toBeGreaterThan(SHIP_HANDLING_DAYS_EUROPE)
  })

  it("falls back to the European window when the origin is unknown", () => {
    expect(shipHandlingDaysForRoute(null, "DE")).toBe(SHIP_HANDLING_DAYS_EUROPE)
    expect(shipHandlingDaysForRoute(undefined, "PL")).toBe(SHIP_HANDLING_DAYS_EUROPE)
  })

  it("falls back to the European window when the destination is unknown", () => {
    expect(shipHandlingDaysForRoute("FR", null)).toBe(SHIP_HANDLING_DAYS_EUROPE)
  })
})

describe("computeShipDeadlineAtForRoute", () => {
  it("matches shipHandlingDaysForRoute", () => {
    const paid = new Date("2026-01-01T00:00:00Z")
    const deadline = computeShipDeadlineAtForRoute(paid, "FR", "FR")
    expect(deadline.getTime() - paid.getTime()).toBe(SHIP_HANDLING_DAYS_DOMESTIC * 86_400_000)
  })
})

describe("buildShipPulseSnapshot", () => {
  it("marks breached when past deadline", () => {
    const deadline = new Date("2026-01-01T00:00:00Z")
    const snap = buildShipPulseSnapshot(deadline, deadline.getTime() + 60_000)
    expect(snap.phase).toBe("breached")
    expect(snap.msRemaining).toBeLessThanOrEqual(0)
  })

  it("isShipDeadlineBreached when phase is breached", () => {
    const deadline = new Date("2026-01-01T00:00:00Z")
    const snap = buildShipPulseSnapshot(deadline, deadline.getTime() + 60_000)
    expect(isShipDeadlineBreached(snap)).toBe(true)
    expect(isShipDeadlineBreached({ phase: "urgent", msRemaining: 3_600_000 })).toBe(false)
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
