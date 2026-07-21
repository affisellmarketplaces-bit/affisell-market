import { describe, expect, it } from "vitest"

import {
  formatRadarSupplierDeliveryLine,
  getDeliveryScore,
  getSLAForCountry,
  isDeliveryAcceptable,
  resolveDeliverySLA,
} from "@/lib/logistics/delivery-sla"

describe("delivery-sla", () => {
  it("FR EU: ideal 3 / max 5", () => {
    const sla = getSLAForCountry("FR")
    expect(sla.idealDays).toBe(3)
    expect(sla.maxDays).toBe(5)
    expect(getDeliveryScore(3, "FR").score).toBe(100)
    expect(getDeliveryScore(5, "FR").score).toBe(70)
    expect(getDeliveryScore(12, "FR").score).toBe(30)
    expect(isDeliveryAcceptable(5, "FR")).toBe(true)
    expect(isDeliveryAcceptable(6, "FR")).toBe(false)
  })

  it("GCC SA: ideal 5 / max 8", () => {
    const sla = getSLAForCountry("SA")
    expect(sla.idealDays).toBe(5)
    expect(sla.maxDays).toBe(8)
  })

  it("priority maps to SLA days", () => {
    expect(resolveDeliverySLA("FR", "speed")).toBe(3)
    expect(resolveDeliverySLA("FR", "balanced")).toBe(5)
    expect(resolveDeliverySLA("FR", "price")).toBe(10)
  })

  it("radar lines boost EU and warn CN for FR", () => {
    expect(formatRadarSupplierDeliveryLine({ count: 3, marketCountry: "FR", origin: "EU", days: 3 })).toMatch(
      /Idéal/
    )
    expect(
      formatRadarSupplierDeliveryLine({ count: 1, marketCountry: "FR", origin: "CN", days: 15 })
    ).toMatch(/Trop lent/)
  })
})
