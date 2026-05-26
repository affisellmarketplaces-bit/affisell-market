import { describe, expect, it } from "vitest"

import { parseAffisellCommissionOverrideFromBody } from "@/lib/supplier-product-affisell-commission-override"

describe("parseAffisellCommissionOverrideFromBody", () => {
  it("parses percent and clears", () => {
    expect(parseAffisellCommissionOverrideFromBody(12)).toBe(1200)
    expect(parseAffisellCommissionOverrideFromBody("15")).toBe(1500)
    expect(parseAffisellCommissionOverrideFromBody(null)).toBe(null)
    expect(parseAffisellCommissionOverrideFromBody("")).toBe(null)
    expect(parseAffisellCommissionOverrideFromBody(undefined)).toBe(undefined)
  })
})
