/**
 * Live sheet check (portfolio row 30): same 12 elements and same rules as the sheet-quality measure; a figure only for
 * an established association; never a computed gain.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { QUALITY_FEATURES } from "@/lib/listing-quality/quality-effect"
import { buildSheetChecklist } from "@/lib/listing-quality/sheet-checklist"
import { countSpecifications, QUALITY_RESERVED_KEYS, sheetSignals, type SheetFacts } from "@/lib/listing-quality/sheet-facts"

const facts = (over: Partial<SheetFacts> = {}): SheetFacts => ({
  name: "Gourde inox isotherme 750 ml",
  descriptionHtml: "<p>" + "Gourde en acier inoxydable double paroi. ".repeat(6) + "</p>",
  imageCount: 5,
  listingKind: "PHYSICAL",
  stock: 12,
  variants: null,
  customColumns: null,
  deliveryMin: 2,
  deliveryMax: 5,
  attributes: [
    { key: "brand", value: "Ovra" },
    { key: "ean", value: "4006381333931" },
    { key: "return_window_days", value: "30" },
  ],
  specCount: 3,
  ...over,
})

describe("shared sheet signals", () => {
  it("reserved keys are never specifications; empty values do not count", () => {
    const attrs = [
      { key: "brand", value: "Ovra" },
      { key: "ean", value: "123" },
      { key: "return_window_days", value: "30" },
      { key: "stock_unconfirmed", value: "1" },
      { key: "matiere", value: "Inox" },
      { key: "contenance", value: " " },
      { key: "couleur", value: "Noir" },
    ]
    expect(countSpecifications(attrs)).toBe(2)
    for (const k of ["brand", "ean", "return_window_days", "stock_unconfirmed"]) expect(QUALITY_RESERVED_KEYS).toContain(k)
  })
  it("reads the sheet like the measure: description stripped of markup, return window, GTIN check digit", () => {
    const s = sheetSignals(facts())
    expect(s.descriptionText.startsWith("Gourde en acier")).toBe(true)
    expect(s.returnWindowDays).toBe(30)
    expect(s.gtinValid).toBe(true)
    expect(sheetSignals(facts({ attributes: [{ key: "ean", value: "4006381333932" }] })).gtinValid).toBe(false)
    expect(sheetSignals(facts({ listingKind: "SOFTWARE" })).physical).toBe(false)
  })
  it("the server measure and the form use this one function (no second definition)", () => {
    const server = readFileSync(join(process.cwd(), "lib/listing-quality/quality-effect.server.ts"), "utf8")
    expect(server).toContain("...sheetSignals({")
    expect(server).not.toMatch(/isValidGtin|indistinctVariantRows|evaluateListingReadiness/)
    const form = readFileSync(join(process.cwd(), "components/supplier/supplier-add-product-form.tsx"), "utf8")
    expect(form).toContain("<CommercialReadinessPanel body={readinessBody}")
  })
})

describe("checklist", () => {
  it("covers the 12 elements; a complete physical sheet has nothing missing except what it lacks", () => {
    const c = buildSheetChecklist(sheetSignals(facts()))
    expect(c.items.map((i) => i.feature).sort()).toEqual([...QUALITY_FEATURES].sort())
    expect(c.items.find((i) => i.feature === "safety_complete")?.state).toBe("missing")
    expect(c.items.find((i) => i.feature === "variants_distinct")?.state).toBe("not_applicable")
    expect(c.items.find((i) => i.feature === "photos_5plus")?.state).toBe("present")
  })
  it("physical-only elements are not applicable to a digital product", () => {
    const c = buildSheetChecklist(sheetSignals(facts({ listingKind: "SOFTWARE", stock: 0 })))
    for (const f of ["gtin_valid", "delivery_declared", "return_extended", "stock_confirmed"] as const) {
      expect(c.items.find((i) => i.feature === f)?.state).toBe("not_applicable")
    }
  })
  it("a figure only for an established positive association (lower bound above 1); missing-with-evidence first", () => {
    const s = sheetSignals(facts({ imageCount: 1, attributes: [] }))
    const c = buildSheetChecklist(s, [
      { feature: "brand_declared", adjustedRatio: 1.4, lo: 1.1 },
      { feature: "photos_3plus", adjustedRatio: 1.9, lo: 1.5 },
      { feature: "gtin_valid", adjustedRatio: 1.2, lo: 0.9 },
    ])
    expect(c.items[0]).toMatchObject({ feature: "photos_3plus", state: "missing", evidence: { ratio: 1.9, lo: 1.5 } })
    expect(c.items[1]).toMatchObject({ feature: "brand_declared", evidence: { ratio: 1.4, lo: 1.1 } })
    expect(c.items.find((i) => i.feature === "gtin_valid")?.evidence).toBeNull()
    expect(c.missingWithEvidence).toBe(2)
  })
  it("never computes a gain: items carry a state and, at most, the marketplace ratio", () => {
    const c = buildSheetChecklist(sheetSignals(facts()), [{ feature: "photos_3plus", adjustedRatio: 2, lo: 1.3 }])
    for (const i of c.items) expect(Object.keys(i).sort()).toEqual(["evidence", "feature", "fromDefault", "state"])
  })
  it("the panel's texts state the limit in every locale", () => {
    for (const loc of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
      const m = JSON.parse(readFileSync(join(process.cwd(), `messages/${loc}.json`), "utf8")) as { supplier: { sheetChecklist: Record<string, unknown> & { label: Record<string, string> } } }
      const c = m.supplier.sheetChecklist
      for (const k of ["title", "intro", "summary", "missingTitle", "presentTitle", "evidence", "caveat", "noEvidence", "allDone", "defaultTag", "deliveryDefault"]) expect(typeof c[k], `${loc}.${k}`).toBe("string")
      for (const f of QUALITY_FEATURES) expect(typeof c.label[f], `${loc}.label.${f}`).toBe("string")
    }
    const fr = JSON.parse(readFileSync(join(process.cwd(), "messages/fr.json"), "utf8")) as { supplier: { sheetChecklist: Record<string, string> } }
    expect(fr.supplier.sheetChecklist.caveat).toContain("pas une relation de cause à effet démontrée")
    expect(fr.supplier.sheetChecklist.caveat).toContain("ne garantit aucune vente supplémentaire")
  })
})
