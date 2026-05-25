import { describe, expect, it } from "vitest"

import {
  formatHoursLeftLabel,
  formatSlaCountdown,
  hoursLeftFromPayment,
  SUPPLIER_LATE_SHIP_PENALTY_PER_ORDER_CENTS,
  SUPPLIER_SHIP_SLA_MS,
  SUPPLIER_SHIP_SLA_URGENT_HOURS,
} from "@/lib/supplier-ship-sla"

describe("formatSlaCountdown", () => {
  it("formats hours and zero-padded minutes", () => {
    expect(formatSlaCountdown(22 * 60 * 60_000 + 4 * 60_000)).toBe("22h04")
    expect(formatSlaCountdown(90_000)).toBe("0h01")
  })
})

describe("hoursLeftFromPayment", () => {
  it("returns 10d minus elapsed time", () => {
    const paymentAt = new Date("2026-01-01T00:00:00Z")
    const nowMs = paymentAt.getTime() + 25 * 3_600_000
    expect(hoursLeftFromPayment(paymentAt, nowMs)).toBe(240 - 25)
  })
})

describe("formatHoursLeftLabel", () => {
  it("formats urgent countdown for title", () => {
    expect(formatHoursLeftLabel(22.5)).toBe("< 22h")
    expect(formatHoursLeftLabel(0.5)).toMatch(/min|< 1h/)
  })
})

describe("SUPPLIER_SHIP_SLA_MS", () => {
  it("is 10 days", () => {
    expect(SUPPLIER_SHIP_SLA_MS).toBe(10 * 24 * 60 * 60 * 1000)
  })
})

describe("penalty constants", () => {
  it("uses 5€ per order and 48h urgent threshold", () => {
    expect(SUPPLIER_LATE_SHIP_PENALTY_PER_ORDER_CENTS).toBe(500)
    expect(SUPPLIER_SHIP_SLA_URGENT_HOURS).toBe(48)
  })
})
