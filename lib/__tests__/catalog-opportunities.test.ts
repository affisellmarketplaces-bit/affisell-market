import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  catalogOpportunitySignals,
  detectCatalogOpportunities,
  rootOfCategory,
  type CategoryStats,
} from "@/lib/strategic-intelligence/catalog-opportunities"
import { metricForSignal, signalFamily, SUPPLY_ATTRIBUTION_CAVEAT, verdictFor } from "@/lib/strategic-intelligence/journal"

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

describe("opportunities → decision journal", () => {
  const ctx = { observedAt: "2026-11-19T06:00:00.000Z", window: { from: "2026-10-20T06:00:00.000Z", to: "2026-11-19T06:00:00.000Z" } }
  const opps = detectCatalogOpportunities([
    stat({ rootId: "r1", orders30d: 25, sellingResellers: 3, sellableProducts: 2, sellableSuppliers: 1 }),
    stat({ rootId: "r2", label: "Jardin", orders30d: 20, ordersOnUnsellable30d: 8, sellableProducts: 50, sellableSuppliers: 5 }),
    stat({ rootId: "r3", label: "Sport", orders30d: 6, sellableProducts: 20, sellableSuppliers: 4, sellableNotListed: 15 }),
  ])

  it("each finding is a cockpit signal of its own family, measured on a supply STATE of its category", () => {
    const signals = catalogOpportunitySignals(opps, ctx)
    expect(signals.map((s) => s.id).sort()).toEqual(["discovery:demand-unavailable:r2", "discovery:supply-gap:r1", "discovery:supply-undistributed:r3"])
    expect(new Set(signals.map((s) => signalFamily(s.id))).size).toBe(3)
    expect(metricForSignal("discovery:supply-gap:r1")).toMatchObject({ metric: "sellable_suppliers", scope: "root:r1", direction: "up" })
    expect(metricForSignal("discovery:demand-unavailable:r2")).toMatchObject({ metric: "sellable_products", scope: "root:r2" })
    expect(metricForSignal("discovery:supply-undistributed:r3")).toMatchObject({ metric: "listed_sellable_share_bps", scope: "root:r3" })
    for (const s of signals) expect(s.confidenceReason).toMatch(/jamais une taille de marché ni une croissance acquise/)
  })

  it("a supply evolution is reported as a correlation, never an attributable result", () => {
    const small = verdictFor("sellable_suppliers", "up", { value: 1, count: 1, base: null }, { value: 3, count: 3, base: null })
    expect(small.verdict).toBe("inconclusive")
    expect(small.reason).toContain("1 → 3")
    expect(small.reason).toContain(SUPPLY_ATTRIBUTION_CAVEAT)
    const big = verdictFor("sellable_products", "up", { value: 10, count: 10, base: null }, { value: 40, count: 40, base: null })
    expect(big.verdict).toBe("improved")
    expect(big.reason).toContain(SUPPLY_ATTRIBUTION_CAVEAT)
    const share = verdictFor("listed_sellable_share_bps", "up", { value: 2500, count: 25, base: 100 }, { value: 6000, count: 60, base: 100 })
    expect(share.verdict).toBe("improved")
  })
})
