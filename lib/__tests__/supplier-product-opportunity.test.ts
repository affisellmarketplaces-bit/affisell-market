import { describe, expect, it } from "vitest"

import {
  estimateExtraSalesFromOpportunity,
  OPPORTUNITY_COMMISSION_BOOST_PP,
  suggestCommissionPct,
} from "@/lib/supplier-product-opportunity"

describe("estimateExtraSalesFromOpportunity", () => {
  it("estimates count × 0.15 sales / 7j", () => {
    expect(estimateExtraSalesFromOpportunity(5)).toBe(0.8)
    expect(estimateExtraSalesFromOpportunity(10)).toBe(1.5)
    expect(estimateExtraSalesFromOpportunity(0)).toBe(0)
  })
})

describe("suggestCommissionPct", () => {
  it("bumps 10% to 12% with default +2pp", () => {
    const { suggested, boostPp } = suggestCommissionPct(10, "PHYSICAL")
    expect(suggested).toBe(12)
    expect(boostPp).toBe(2)
  })

  it("uses OPPORTUNITY_COMMISSION_BOOST_PP constant", () => {
    expect(OPPORTUNITY_COMMISSION_BOOST_PP).toBe(2)
  })
})
