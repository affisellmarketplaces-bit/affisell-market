import { describe, expect, it } from "vitest"

import { AFFISELL_BROWSE_DEPARTMENTS } from "@/lib/taxonomy/browse-departments-shared"
import { resolveEbayLabelToGoogleTarget } from "@/lib/taxonomy/ebay-google-mapping"
import { normalizeTaxonomyLabel } from "@/lib/taxonomy/normalize-taxonomy-label"

describe("normalizeTaxonomyLabel", () => {
  it("strips accents and normalizes quotes", () => {
    expect(normalizeTaxonomyLabel("  Téléphonie, mobilité  ")).toBe("telephonie, mobilite")
    expect(normalizeTaxonomyLabel("Art et antiquités")).toBe("art et antiquites")
  })
})

describe("browse-departments-shared", () => {
  it("has unique ids and valid targets", () => {
    const ids = AFFISELL_BROWSE_DEPARTMENTS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const def of AFFISELL_BROWSE_DEPARTMENTS) {
      expect(def.labelFr.length).toBeGreaterThan(0)
      expect(def.labelEn.length).toBeGreaterThan(0)
      if (def.target.kind === "googleFullPath") {
        expect(def.target.fullPathFr).toContain(" > ")
      }
    }
  })
})

describe("ebay-google-mapping", () => {
  it("maps known eBay labels to Google targets", () => {
    expect(resolveEbayLabelToGoogleTarget("High-tech")).toEqual({
      kind: "googleRoot",
      rootNameFr: "Appareils électroniques",
    })
    expect(resolveEbayLabelToGoogleTarget("Jeux vidéo, consoles")).toEqual({
      kind: "googleFullPath",
      fullPathFr: "Logiciels > Jeux vidéo",
    })
  })

  it("falls back to googleRoot with original label", () => {
    expect(resolveEbayLabelToGoogleTarget("Vêtements et accessoires")).toEqual({
      kind: "googleRoot",
      rootNameFr: "Vêtements et accessoires",
    })
  })

  it("returns unmapped for empty input", () => {
    expect(resolveEbayLabelToGoogleTarget("   ")).toEqual({ kind: "unmapped" })
  })
})
