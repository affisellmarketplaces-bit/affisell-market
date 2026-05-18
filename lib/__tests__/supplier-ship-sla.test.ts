import { describe, expect, it } from "vitest"

import {
  formatSlaCountdown,
  formatSlaHoursShort,
  SUPPLIER_SHIP_SLA_MS,
} from "@/lib/supplier-ship-sla"

describe("formatSlaCountdown", () => {
  it("formats hours and zero-padded minutes", () => {
    expect(formatSlaCountdown(22 * 60 * 60_000 + 4 * 60_000)).toBe("22h04")
    expect(formatSlaCountdown(90_000)).toBe("0h01")
  })
})

describe("formatSlaHoursShort", () => {
  it("floors to hour bucket for title", () => {
    expect(formatSlaHoursShort(22 * 60 * 60_000 + 4 * 60_000)).toBe("22h")
    expect(formatSlaHoursShort(30 * 60_000)).toBe("1h")
  })
})

describe("SUPPLIER_SHIP_SLA_MS", () => {
  it("is 48 hours", () => {
    expect(SUPPLIER_SHIP_SLA_MS).toBe(48 * 60 * 60 * 1000)
  })
})
