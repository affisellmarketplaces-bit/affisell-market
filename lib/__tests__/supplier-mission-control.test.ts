import { describe, expect, it } from "vitest"

import { pctChange } from "@/lib/supplier-mission-control"

describe("pctChange", () => {
  it("returns percent delta vs previous period", () => {
    expect(pctChange(110, 100)).toBe(10)
    expect(pctChange(90, 100)).toBe(-10)
  })

  it("returns 0 when both are zero", () => {
    expect(pctChange(0, 0)).toBe(0)
  })

  it("returns null when previous is zero and current is positive", () => {
    expect(pctChange(50, 0)).toBeNull()
  })
})
