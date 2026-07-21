import { describe, expect, it } from "vitest"

import {
  getRadarCopyForAffiliate,
  getRadarCopyForSupplier,
  radarActionCtaLabel,
  radarArbitrageGoldHint,
  radarBulkBarLabel,
  radarEuSuppliersFastLabel,
  radarSupplierMatchEmptyCopy,
} from "@/lib/radar/radar-copy"

describe("radar-copy persona split", () => {
  it("affiliate never says Grossiste", () => {
    const copy = getRadarCopyForAffiliate({ score: 92, supplierCount: 0 }, "FR")
    expect(copy.opportunityLabel).not.toMatch(/Grossiste/i)
    expect(copy.opportunityLabel).toMatch(/sans stock/i)
    expect(copy.ctaLabel).toBe("Lister sans stock →")
    expect(copy.arbitrageLabel).toMatch(/sans stock/)
    expect(copy.tooltip).toMatch(/0 stock/)
  })

  it("supplier uses Grossiste opportunity + stock CTA", () => {
    const copy = getRadarCopyForSupplier(
      { score: 92, searches: 40_000, id: "w1", supplierCount: 3 },
      "FR"
    )
    expect(copy.opportunityLabel).toMatch(/Grossiste/)
    expect(copy.supplierLabel).toMatch(/Rupture imminente/)
    expect(copy.ctaLabel).toBe("Devenir fournisseur →")
    expect(copy.ctaHref("FR")).toContain("winnerId=w1")
    expect(copy.ctaHref("FR")).toContain("mode=supplier")
    expect(copy.arbitrageLabel).toMatch(/resellers/)
  })

  it("bulk bar labels differ by role", () => {
    expect(radarBulkBarLabel({ role: "SUPPLIER", count: 20 })).toMatch(/fournisseur exclusif/)
    expect(radarBulkBarLabel({ role: "AFFILIATE", count: 20, marginEuro: 215 })).toMatch(
      /sans stock/
    )
  })

  it("legacy helpers stay affiliate no-stock", () => {
    expect(radarSupplierMatchEmptyCopy()).not.toMatch(/Grossiste/i)
    expect(radarActionCtaLabel("AFFILIATE")).toBe("Lister sans stock →")
    expect(radarActionCtaLabel("SUPPLIER")).toBe("Devenir fournisseur →")
    expect(radarArbitrageGoldHint()).toMatch(/sans stock/)
    expect(radarEuSuppliersFastLabel()).toMatch(/Sans stock/)
  })
})
