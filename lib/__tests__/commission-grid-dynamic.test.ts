import { describe, expect, it } from "vitest"

import {
  applySupplierCommissionDynamics,
  volumeTierBonusBps,
} from "@/lib/commission-grid-dynamic"

describe("commission grid dynamics", () => {
  it("returns zero bonus below first tier", () => {
    expect(volumeTierBonusBps(100_000)).toEqual({ bonusBps: 0, tierLabel: null })
  })

  it("unlocks growth tier bonus", () => {
    expect(volumeTierBonusBps(3_000_000)).toEqual({ bonusBps: 100, tierLabel: "Growth" })
  })

  it("caps effective bps after dynamics", () => {
    const result = applySupplierCommissionDynamics({
      baseBps: 2400,
      trailingGmvCents: 60_000_000,
    })
    expect(result.volumeBonusBps).toBe(200)
    expect(result.effectiveBps).toBe(2600)
  })
})
