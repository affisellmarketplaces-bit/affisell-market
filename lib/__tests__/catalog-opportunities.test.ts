import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { detectCatalogOpportunities, rootOfCategory, type CategoryStats } from "@/lib/strategic-intelligence/catalog-opportunities"

const stat = (over: Partial<CategoryStats> = {}): CategoryStats => ({
  rootId: "r1",
  label: "Maison",
  orders30d: 0,
  ordersOnUnsellable30d: 0,
  sellingResellers: 0,
  activeProducts: 0,
  sellableProducts: 0,
  sellableSuppliers: 0,
  sellableNotListed: 0,
  ...over,
})

describe("supply ↔ demand opportunities (admin, aggregates only)", () => {
  it("under-supplied: real demand from several resellers, thin sellable supply", () => {
    const [o] = detectCatalogOpportunities([stat({ orders30d: 25, sellingResellers: 3, sellableProducts: 2, sellableSuppliers: 1 })])
    expect(o).toMatchObject({ kind: "under_supplied", action: "recruit_suppliers", confidence: "medium" })
    // One reseller's demand is not a market.
    expect(detectCatalogOpportunities([stat({ orders30d: 25, sellingResellers: 1, sellableProducts: 2, sellableSuppliers: 1 })])).toEqual([])
  })

  it("demand stuck on products that can not be bought today", () => {
    const [o] = detectCatalogOpportunities([stat({ orders30d: 20, ordersOnUnsellable30d: 8, sellableProducts: 50, sellableSuppliers: 5 })])
    expect(o).toMatchObject({ kind: "demand_on_unavailable", evidence: { sharePct: 40 } })
    expect(detectCatalogOpportunities([stat({ orders30d: 100, ordersOnUnsellable30d: 8, sellableProducts: 50, sellableSuppliers: 5 })])).toEqual([])
  })

  it("under-distributed: the category sells, most sellable supply has no reseller", () => {
    const [o] = detectCatalogOpportunities([stat({ orders30d: 6, sellableProducts: 20, sellableSuppliers: 4, sellableNotListed: 15 })])
    expect(o).toMatchObject({ kind: "under_distributed", action: "recruit_resellers", evidence: { unlistedPct: 75 } })
    expect(detectCatalogOpportunities([stat({ orders30d: 0, sellableProducts: 20, sellableNotListed: 20 })])).toEqual([])
  })

  it("never names anyone: evidence is counts only, reseller count hidden below 2", () => {
    const out = detectCatalogOpportunities([stat({ orders30d: 30, sellingResellers: 2, sellableProducts: 1, sellableSuppliers: 1 })])
    for (const o of out) for (const v of Object.values(o.evidence)) expect(typeof v).toBe("number")
  })

  it("roots follow the parent chain", () => {
    const parent = new Map<string, string | null>([["leaf", "mid"], ["mid", "root"], ["root", null]])
    expect(rootOfCategory("leaf", parent)).toBe("root")
    expect(rootOfCategory(null, parent)).toBeNull()
  })

  it("is admin-only and read-only", () => {
    const root = path.resolve(__dirname, "../..")
    const route = readFileSync(path.join(root, "app/api/admin/catalog-opportunities/route.ts"), "utf8")
    expect(route).toContain("requireAdminSession")
    const page = readFileSync(path.join(root, "app/admin/catalog-opportunities/page.tsx"), "utf8")
    expect(page).toContain('role !== "ADMIN"')
    const server = readFileSync(path.join(root, "lib/strategic-intelligence/catalog-opportunities.server.ts"), "utf8")
    expect(server).not.toMatch(/\.(create|update|delete|upsert)(Many)?\(/)
  })
})
