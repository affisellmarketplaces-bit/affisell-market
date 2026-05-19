import { describe, expect, it } from "vitest"

import { calcMarginCents } from "@/lib/product-card-margin"

describe("calcMarginCents", () => {
  it("returns null without supplier price", () => {
    expect(calcMarginCents(29.99, undefined)).toBeNull()
    expect(calcMarginCents(29.99, null)).toBeNull()
    expect(calcMarginCents(29.99, 0)).toBeNull()
  })

  it("computes margin in cents from EUR prices", () => {
    expect(calcMarginCents(29.99, 19.99)).toBe(1000)
  })

  it("returns null when margin is not positive", () => {
    expect(calcMarginCents(10, 12)).toBeNull()
  })
})
