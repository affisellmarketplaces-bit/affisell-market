import { describe, expect, it } from "vitest"

import {
  bookingHoldConfirmGraceMinutes,
  isHoldExpiredBeyondGrace,
} from "@/lib/booking/hold-grace"

describe("booking hold grace", () => {
  it("defaults grace to 5 minutes", () => {
    expect(bookingHoldConfirmGraceMinutes()).toBe(5)
  })

  it("keeps hold during post-expiry grace window", () => {
    const now = new Date("2026-06-10T12:00:00.000Z")
    const holdExpiresAt = new Date("2026-06-10T11:58:00.000Z")
    expect(isHoldExpiredBeyondGrace(holdExpiresAt, now)).toBe(false)
  })

  it("treats hold as stale after grace elapsed", () => {
    const now = new Date("2026-06-10T12:10:00.000Z")
    const holdExpiresAt = new Date("2026-06-10T11:50:00.000Z")
    expect(isHoldExpiredBeyondGrace(holdExpiresAt, now)).toBe(true)
  })
})
