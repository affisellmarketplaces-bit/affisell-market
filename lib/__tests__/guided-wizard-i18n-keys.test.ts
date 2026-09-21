import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import en from "@/messages/en.json"

type Tree = Record<string, unknown>
const at = (path: string): Tree | undefined =>
  path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Tree)[k] : undefined), en) as Tree | undefined

const FILES: Array<[string, Record<string, string>]> = [
  ["components/supplier/guided-add-product-button.tsx", { tWiz: "supplier.guidedWizard", tTax: "supplier.guidedTaxonomy", tDesc: "supplier.guidedDescription", tDef: "supplier.guidedDefaults" }],
  ["components/supplier/guided-category-picker.tsx", { tWiz: "supplier.guidedWizard" }],
  ["components/supplier/guided-ai-copilot-panel.tsx", { t: "supplier.guidedCopilot" }],
  ["components/supplier/guided-taxonomy-suggestions.tsx", { t: "supplier.guidedTaxonomy" }],
]

describe("guided wizard — every translation key used in code exists in the catalogue", () => {
  for (const [file, translators] of FILES) {
    it(file, () => {
      const src = readFileSync(file, "utf8")
      const missing: string[] = []
      for (const [fn, ns] of Object.entries(translators)) {
        const tree = at(ns)
        expect(tree, `namespace ${ns}`).toBeTruthy()
        for (const m of src.matchAll(new RegExp(`\\b${fn}\\(\\s*"([A-Za-z0-9_]+)"`, "g"))) {
          if (!(m[1]! in tree!)) missing.push(`${ns}.${m[1]}`)
        }
      }
      expect(missing).toEqual([])
    })
  }

  it("covers the department keys built from the four wizard shelves", () => {
    const tree = at("supplier.guidedWizard")!
    for (const shelf of ["Fashion", "Home", "Beauty", "Food"]) {
      expect(tree).toHaveProperty(`cat${shelf}`)
      expect(tree).toHaveProperty(`cat${shelf}Hint`)
    }
    for (const k of ["phMaterial", "phColor", "phDimensions", "phStock", "phPrice", "stepBasics", "stepDetails", "stepGpsr", "stepPreview"]) {
      expect(tree).toHaveProperty(k)
    }
  })
})

describe("photo/title conflict warning keys", () => {
  it("exists for both suggestion surfaces", () => {
    expect(at("supplier.guidedTaxonomy")).toHaveProperty("photoTitleConflict")
    expect(at("supplier.expressTaxonomy")).toHaveProperty("photoTitleConflict")
  })
})
