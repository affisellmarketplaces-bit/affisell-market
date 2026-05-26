import { describe, expect, it } from "vitest"

import { titleTokenOverlap } from "@/lib/category-marketplace-learning"

describe("titleTokenOverlap", () => {
  it("matches similar French product titles (ventilateur portable)", () => {
    const a = "Ventilateur portable rechargeable USB mini"
    const b = "Mini ventilateur portable USB rechargeable bureau"
    expect(titleTokenOverlap(a, b)).toBeGreaterThan(0.35)
  })

  it("rejects unrelated titles", () => {
    const a = "Ventilateur portable rechargeable USB"
    const b = "Dérailleur vélo Shimano 11 vitesses"
    expect(titleTokenOverlap(a, b)).toBeLessThan(0.2)
  })
})
