import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { buildProductJourney, nextSupplierAction, type JourneyFacts } from "@/lib/supplier-journey/product-journey"

const facts = (o: Partial<JourneyFacts> = {}): JourneyFacts => ({
  name: "Lampe",
  imageCount: 3,
  hasCategory: true,
  safetyReady: true,
  safetyMissing: [],
  availableUnits: 5,
  commissionRate: 15,
  isDraft: false,
  active: true,
  hold: null,
  listedByResellers: 2,
  paidOrders30d: 4,
  costDeclared: false,
  costQualification: null,
  ...o,
})
const status = (f: JourneyFacts) => Object.fromEntries(buildProductJourney(f).map((s) => [s.id, s.status]))

describe("supplier product journey", () => {
  it("a product on sale, picked and selling: everything done, costs stay optional", () => {
    expect(status(facts())).toEqual({
      sheet: "done",
      safety: "done",
      stock: "done",
      commission: "done",
      publication: "done",
      resellers: "done",
      sales: "done",
      costs: "optional",
    })
    expect(nextSupplierAction(buildProductJourney(facts()))).toBeNull()
  })
  it("a fresh draft: the first supplier action is the sheet; resellers / sales are not supplier actions", () => {
    const steps = buildProductJourney(facts({ imageCount: 0, isDraft: true, listedByResellers: 0, paidOrders30d: 0 }))
    expect(nextSupplierAction(steps)).toBe("sheet")
    expect(steps.find((s) => s.id === "sheet")?.detail).toBe("photo")
    expect(steps.find((s) => s.id === "sales")?.status).toBe("waiting")
  })
  it("an Affisell hold is 'blocked', never a supplier to-do", () => {
    const steps = buildProductJourney(facts({ active: false, hold: "product_suspended" }))
    expect(steps.find((s) => s.id === "publication")).toEqual({ id: "publication", status: "blocked", detail: "product_suspended" })
    expect(nextSupplierAction(steps)).toBeNull()
  })
  it("digital goods: product safety is not applicable (done); stock 0 is a to-do", () => {
    const steps = buildProductJourney(facts({ safetyReady: null, availableUnits: 0 }))
    expect(steps.find((s) => s.id === "safety")?.status).toBe("done")
    expect(nextSupplierAction(steps)).toBe("stock")
  })
  it("declared costs never condition publication: the journey has no dependency between them", () => {
    expect(status(facts({ costDeclared: true, costQualification: "disputed" })).publication).toBe("done")
  })
  it("the route is supplier-only and the server checks ownership", () => {
    const root = path.resolve(__dirname, "../..")
    expect(readFileSync(path.join(root, "app/api/supplier/products/[id]/journey/route.ts"), "utf8")).toContain('role !== "SUPPLIER"')
    expect(readFileSync(path.join(root, "lib/supplier-journey/product-journey.server.ts"), "utf8")).toContain("p.supplierId !== supplierId")
  })
  it("every locale names every step and status", () => {
    const root = path.resolve(__dirname, "../..")
    for (const loc of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
      const m = JSON.parse(readFileSync(path.join(root, `messages/${loc}.json`), "utf8")).supplier.productJourney
      expect(Object.keys(m.steps).sort()).toEqual(["commission", "costs", "publication", "resellers", "safety", "sales", "sheet", "stock"])
      expect(Object.keys(m.status).sort()).toEqual(["blocked", "done", "optional", "todo", "waiting"])
    }
  })
})
