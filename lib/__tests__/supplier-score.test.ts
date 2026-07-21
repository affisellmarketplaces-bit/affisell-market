import { describe, expect, it } from "vitest"

import {
  calculateDeliveryScore,
  calculateTrustScore,
  getSupplierBadge,
  isSuspiciousLowRater,
} from "@/lib/logistics/supplier-score"

describe("supplier-score", () => {
  it("rewards on-time and early delivery", () => {
    const perfect = calculateTrustScore({
      totalOrders: 10,
      onTimeDeliveries: 10,
      avgDeliveryDays: 3,
      promisedVsActualDelta: -0.5,
      disputeRate: 0,
      responseTimeAvg: 30,
    })
    expect(perfect).toBeGreaterThanOrEqual(90)
    expect(getSupplierBadge(perfect).tier).toBe("top")
  })

  it("penalizes chronic lateness", () => {
    const late = calculateTrustScore({
      totalOrders: 10,
      onTimeDeliveries: 4,
      avgDeliveryDays: 12,
      promisedVsActualDelta: 4,
      disputeRate: 0.1,
      responseTimeAvg: 2000,
    })
    expect(late).toBeLessThan(60)
  })

  it("delivery score bands", () => {
    expect(calculateDeliveryScore(3, 3)).toBe(100)
    expect(calculateDeliveryScore(3, 4)).toBe(80)
    expect(calculateDeliveryScore(3, 6)).toBe(50)
    expect(calculateDeliveryScore(3, 10)).toBe(20)
  })

  it("flags serial 1-star reviewers", () => {
    expect(isSuspiciousLowRater({ reviewCount: 5, onesCount: 5 })).toBe(true)
    expect(isSuspiciousLowRater({ reviewCount: 5, onesCount: 1 })).toBe(false)
  })
})
