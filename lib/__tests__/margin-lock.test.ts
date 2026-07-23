import { describe, expect, it } from "vitest"

import { getMarginLockStatus, MARGIN_LOCK_DAYS, MARGIN_LOCK_MAX_INCREASE } from "@/lib/margin/margin-lock-types"

describe("margin-lock-types", () => {
  it("exports 7-day lock constants", () => {
    expect(MARGIN_LOCK_DAYS).toBe(7)
    expect(MARGIN_LOCK_MAX_INCREASE).toBe(0.15)
  })

  it("computes active countdown and protected profit", () => {
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000)
    const status = getMarginLockStatus({
      status: "ACTIVE",
      expiresAt,
      salePrice: 49,
      lockedCost: 22,
    })
    expect(status.isActive).toBe(true)
    expect(status.daysLeft).toBe(2)
    expect(status.profitProtected).toBe(27)
    expect(status.isExpiringSoon).toBe(false)
  })

  it("flags expiring soon under 24h", () => {
    const status = getMarginLockStatus({
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      salePrice: 40,
      lockedCost: 20,
    })
    expect(status.isExpiringSoon).toBe(true)
    expect(status.hoursLeft).toBeLessThan(24)
  })
})
