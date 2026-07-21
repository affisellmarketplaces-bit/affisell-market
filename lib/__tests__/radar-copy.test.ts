import { describe, expect, it } from "vitest"

import {
  radarActionCtaLabel,
  radarArbitrageGoldHint,
  radarSupplierMatchEmptyCopy,
  radarEuSuppliersFastLabel,
} from "@/lib/radar/radar-copy"

describe("radar-copy no-stock", () => {
  it("never says Grossiste on empty match", () => {
    expect(radarSupplierMatchEmptyCopy()).not.toMatch(/Grossiste/i)
    expect(radarSupplierMatchEmptyCopy()).toMatch(/sans stock/i)
  })

  it("labels affiliate CTA as Lister sans stock", () => {
    expect(radarActionCtaLabel("AFFILIATE")).toBe("Lister sans stock →")
    expect(radarActionCtaLabel("SUPPLIER")).toBe("Sourcer →")
  })

  it("gold hint explains economics without stock", () => {
    expect(radarArbitrageGoldHint()).toMatch(/36,75€/)
    expect(radarArbitrageGoldHint()).toMatch(/sans stock/)
  })

  it("EU suppliers label includes Sans stock", () => {
    expect(radarEuSuppliersFastLabel()).toBe("✅ 3 fournisseurs EU - 4j - Sans stock")
  })
})
