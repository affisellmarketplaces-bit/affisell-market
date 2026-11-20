import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { compareModelsOnOrders, pickRepresentativeOrders } from "@/lib/contract-models/comparison"
import { DRAFT_CONTRACT_MODELS } from "@/lib/contract-models/drafts"
import { sweepLinesFromOrders } from "@/lib/contract-models/history-lines"
import type { EconOrder } from "@/lib/strategic-intelligence/product-economics"
import {
  declarationInForceAt,
  declarationWarnings,
  parseStoredDeclaration,
  parseSupplierCostInput,
  type StoredDeclaration,
} from "@/lib/supplier-costs/declaration"
import { centsToEuroText, eurosToCents } from "@/lib/supplier-costs/euro-input"

const root = path.resolve(__dirname, "../..")
const decl = (at: string, unit: number, delivery = 0): StoredDeclaration => ({
  unitCostCents: unit,
  deliveryCostCents: delivery,
  source: "manufacturer",
  leadTimeDays: null,
  minimumOrderQty: null,
  note: "",
  declaredAt: at,
  declaredBy: "s1",
})

describe("what a supplier may declare", () => {
  it("strict: no guessed cost, no default source, bounded values", () => {
    expect(parseSupplierCostInput({ unitCostCents: 1200, source: "wholesaler" })).toMatchObject({ ok: true, value: { deliveryCostCents: 0 } })
    expect(parseSupplierCostInput({ source: "wholesaler" })).toEqual({ ok: false, errors: ["unit_cost_invalid"] })
    expect(parseSupplierCostInput({ unitCostCents: 12.5, source: "x" })).toEqual({ ok: false, errors: ["unit_cost_invalid", "source_invalid"] })
    expect(parseSupplierCostInput({ unitCostCents: 100, source: "own_stock", leadTimeDays: 900 }).ok).toBe(false)
    expect(parseSupplierCostInput({ unitCostCents: 999_999_999, source: "own_stock" }).ok).toBe(false)
  })
  it("a malformed stored row is not a cost", () => {
    expect(parseStoredDeclaration({ unitCostCents: 1 })).toBeNull()
    expect(parseStoredDeclaration(decl("2026-11-01T00:00:00Z", 500))?.unitCostCents).toBe(500)
  })
  it("euro text ↔ cents, never guessed", () => {
    expect(eurosToCents("12,50")).toBe(1250)
    expect(eurosToCents("12.5")).toBe(1250)
    expect(eurosToCents("12,505")).toBeNull()
    expect(eurosToCents("abc")).toBeNull()
    expect(centsToEuroText(1250)).toBe("12,50")
  })
  it("warns, never blocks, when the cost exceeds the supplier's own price", () => {
    expect(declarationWarnings(decl("2026-11-01T00:00:00Z", 900, 200), 1000)).toEqual(["cost_above_supplier_price"])
  })
})

describe("no retroactive cost", () => {
  const history = [decl("2026-10-01T00:00:00Z", 500), decl("2026-11-01T00:00:00Z", 700)]
  it("the declaration in force at the payment applies, never a later one", () => {
    expect(declarationInForceAt(history, new Date("2026-10-15T00:00:00Z"))?.unitCostCents).toBe(500)
    expect(declarationInForceAt(history, new Date("2026-11-05T00:00:00Z"))?.unitCostCents).toBe(700)
    expect(declarationInForceAt(history, new Date("2026-09-01T00:00:00Z"))).toBeNull()
  })
})

describe("simulation uses a declared cost only as a labelled declaration", () => {
  const order = (id: string, paidAt: string, autoBuy = false) =>
    ({
      orderId: id,
      productId: "p1",
      paidAt: new Date(paidAt),
      totalCents: 12_000,
      taxCents: 2_000,
      stripeFeesCents: 0,
      refundedCents: 0,
      taxReturnedCents: 0,
      disputed: false,
      split: { sellingPriceCents: 10_000, supplierPriceCents: 8_000, basePriceCents: 0, supplierCommissionRateBps: 1_000, supplierFeeCents: 0, usesAffisellAutoBuy: autoBuy, aeWholesaleCents: autoBuy ? 6_000 : 0 },
      transfers: [],
    }) as unknown as EconOrder & { paidAt: Date }

  it("a catalogue order paid after a declaration joins the DECLARED pool; one paid before does not", () => {
    const lines = sweepLinesFromOrders(
      [order("before", "2026-09-15T00:00:00Z"), order("after", "2026-10-15T00:00:00Z"), order("ae", "2026-10-15T00:00:00Z", true)],
      { catalogue: 1_000, autoBuy: 1_700 },
      new Map([["p1", [decl("2026-10-01T00:00:00Z", 5_000, 400)]]])
    )
    expect(lines.declared.map((l) => [l.orderId, l.sourceCostCents, l.sourceCostKind])).toEqual([["after", 5_400, "declared_by_supplier"]])
    expect(lines.sourced.map((l) => [l.orderId, l.sourceCostKind])).toEqual([["ae", "recorded_purchase"]])
  })

  it("the comparison names the origin and adds the 'declared, not verified' hypothesis", () => {
    const lines = sweepLinesFromOrders(
      [order("after", "2026-10-15T00:00:00Z")],
      { catalogue: 1_000, autoBuy: 1_700 },
      new Map([["p1", [decl("2026-10-01T00:00:00Z", 5_000)]]])
    )
    const [row] = compareModelsOnOrders(DRAFT_CONTRACT_MODELS, pickRepresentativeOrders(lines.declared))
    expect(row.recorded.sourceCostOrigin).toBe("declared_by_supplier")
    const c1 = row.models["delegated-purchase"]
    expect(c1.computable && c1.hypotheses.some((h) => h.includes("déclaré par le fournisseur"))).toBe(true)
  })
})

describe("confidentiality and separation", () => {
  it("the route is supplier-only, same-site, and never writes price, commission, stock or publication", () => {
    const route = readFileSync(path.join(root, "app/api/supplier/products/[id]/supply-cost/route.ts"), "utf8")
    expect(route).toContain('role !== "SUPPLIER"')
    expect(route).toContain("assertSameSiteRequestOrigin(req)")
    const server = readFileSync(path.join(root, "lib/supplier-costs/declaration.server.ts"), "utf8")
    expect(server).not.toMatch(/product\.update|productAttribute|affiliateProduct/)
    expect(server).toContain("p.supplierId !== supplierId")
  })
  it("only the supplier route, the supplier form section and the admin simulation import the declarations", () => {
    const allowed = new Set([
      "app/api/supplier/products/[id]/supply-cost/route.ts",
      "components/supplier/supply-cost-section.tsx",
      "lib/contract-models/history-lines.ts",
      "lib/contract-models/simulation.server.ts",
      "lib/supplier-costs/declaration.server.ts",
      "lib/supplier-costs/declared-vs-observed.ts",
      "app/api/supplier/products/[id]/supply-cost/qualification/route.ts",
      "app/api/admin/products/[id]/supply-cost/route.ts",
      // The supplier's own journey reads only its declaration status (own product).
      "lib/supplier-journey/product-journey.server.ts",
      // Catalogue health reads back ONLY the lead time the supplier declared, for its own products (ids scoped to it).
      "lib/supplier-catalog-health/diagnose.server.ts",
    ])
    const found: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`
        if (e.isDirectory()) {
          if (e.name !== "node_modules" && e.name !== "__tests__") walk(rel)
        } else if (/\.(ts|tsx)$/.test(e.name) && readFileSync(path.join(root, rel), "utf8").includes("supplier-costs/declaration")) {
          found.push(rel)
        }
      }
    }
    for (const d of ["app", "components", "lib"]) walk(d)
    expect(found.filter((f) => !allowed.has(f))).toEqual([])
  })
  it("every locale explains the section", () => {
    for (const loc of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
      const m = JSON.parse(readFileSync(path.join(root, `messages/${loc}.json`), "utf8"))
      expect(Object.keys(m.supplier.supplyCost.sources)).toEqual(["own_stock", "manufacturer", "wholesaler", "dropship_source", "other"])
      expect(typeof m.supplier.supplyCost.confidential).toBe("string")
    }
  })
})
