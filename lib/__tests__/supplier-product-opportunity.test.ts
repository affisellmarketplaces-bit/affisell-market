import { describe, expect, it } from "vitest"

import {
  estimateExtraSalesFromOpportunity,
  OPPORTUNITY_COMMISSION_BOOST_PP,
  suggestCommissionPct,
} from "@/lib/supplier-product-opportunity"

describe("estimateExtraSalesFromOpportunity", () => {
  it("estimates ~3 extra sales for 5 affiliates and 23 views with +5pp", () => {
    const n = estimateExtraSalesFromOpportunity(5, 23, OPPORTUNITY_COMMISSION_BOOST_PP)
    expect(n).toBeGreaterThanOrEqual(2)
    expect(n).toBeLessThanOrEqual(5)
  })
})

describe("suggestCommissionPct", () => {
  it("bumps 10% to 15% on physical goods", () => {
    const { suggested, boostPp } = suggestCommissionPct(10, "PHYSICAL")
    expect(suggested).toBe(15)
    expect(boostPp).toBe(5)
  })
})
