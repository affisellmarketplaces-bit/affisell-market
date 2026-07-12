import { describe, expect, it } from "vitest"

import {
  CONVERSION_DISCLAIMER,
  PROBABILITY_DISCLAIMER,
  REVENUE_DISCLAIMER,
  SMART_MARGIN_FOOTER,
  withRevenueDisclaimer,
} from "@/lib/legal/disclaimers"

describe("smart margin legal (EU)", () => {
  it("revenue disclaimer mentions non-guarantie", () => {
    expect(REVENUE_DISCLAIMER).toMatch(/Estimation/i)
    expect(REVENUE_DISCLAIMER).toMatch(/non garanti/i)
  })

  it("probability disclaimer is non-contractual", () => {
    expect(PROBABILITY_DISCLAIMER).toMatch(/Probabilité/i)
    expect(PROBABILITY_DISCLAIMER).toMatch(/Non contractuelle/i)
  })

  it("withRevenueDisclaimer appends legal suffix", () => {
    const line = withRevenueDisclaimer("120 €")
    expect(line).toContain("120 €")
    expect(line).toContain(REVENUE_DISCLAIMER)
  })

  it("every € figure in API response includes disclaimer keys", () => {
    const required = [REVENUE_DISCLAIMER, PROBABILITY_DISCLAIMER, CONVERSION_DISCLAIMER, SMART_MARGIN_FOOTER]
    for (const d of required) {
      expect(d.startsWith("*")).toBe(true)
    }
  })
})
