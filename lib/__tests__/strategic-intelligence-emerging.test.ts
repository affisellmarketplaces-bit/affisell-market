import { describe, expect, it } from "vitest"

import { detectEmerging, emergingSignals, type EmergingCounts } from "@/lib/strategic-intelligence/emerging"
import { metricForSignal } from "@/lib/strategic-intelligence/journal"
import { entitySynthesisSignals } from "@/lib/strategic-intelligence/synthesis"

const ctx = { observedAt: "2026-11-17T08:00:00.000Z", window: { from: "2026-09-22T08:00:00.000Z", to: "2026-11-17T08:00:00.000Z" } }
const row = (productId: string, recent: number, prior: number, sellingResellers = 2): EmergingCounts => ({ productId, name: `P ${productId}`, recent, prior, sellingResellers })

/** Products that follow the marketplace exactly: 1 order per 7 days → 2 recent / 6 prior. */
const steady = (n: number) => Array.from({ length: n }, (_, i) => row(`s${i}`, 2, 6))

function market(rows: EmergingCounts[]) {
  return { recent: rows.reduce((s, r) => s + r.recent, 0), prior: rows.reduce((s, r) => s + r.prior, 0) }
}

describe("emerging products — accelerating more than the marketplace", () => {
  it("flags a product whose daily rate jumps far above the marketplace's", () => {
    const rows = [row("hot", 15, 6), ...steady(50)]
    const f = detectEmerging(rows, market(rows))
    expect(f.map((x) => x.productId)).toEqual(["hot"])
    expect(f[0].growth).toBeCloseTo(15 / 14 / (6 / 42), 10)
  })

  it("a marketplace-wide surge is not many emerging products", () => {
    // Everything triples: the same 'hot' acceleration is now ordinary.
    const rows = [row("hot", 15, 6), ...Array.from({ length: 50 }, (_, i) => row(`s${i}`, 6, 6))]
    expect(detectEmerging(rows, market(rows))).toEqual([])
  })

  it("small counts are not trends: 5 vs 0 is below the minimum total", () => {
    const rows = [row("tiny", 5, 0), ...steady(50)]
    expect(detectEmerging(rows, market(rows))).toEqual([])
  })

  it("a brand-new product with real volume is detected (growth = new)", () => {
    const rows = [row("new", 12, 0), ...steady(50)]
    const f = detectEmerging(rows, market(rows))
    expect(f[0]?.productId).toBe("new")
    expect(f[0].growth).toBe(Number.POSITIVE_INFINITY)
  })

  it("no reference period → no comparison", () => {
    expect(detectEmerging([row("a", 20, 0)], { recent: 20, prior: 0 })).toEqual([])
  })

  it("an ordinary spread over many products raises nothing (Bonferroni)", () => {
    // 200 products with mild deterministic noise around the marketplace rate.
    const rows = Array.from({ length: 200 }, (_, i) => row(`p${i}`, 2 + (i % 4), 6 + ((i * 7) % 5)))
    expect(detectEmerging(rows, market(rows))).toEqual([])
  })
})

describe("signals", () => {
  it("early (few resellers) = important; widely listed = study; never claims a change was made", () => {
    const rows = [row("hot", 15, 6, 3), row("big", 16, 6, 1), ...steady(50)]
    const f = detectEmerging(rows, market(rows))
    const out = emergingSignals(f, new Map([["hot", 1], ["big", 12]]), ctx)
    const hot = out.find((s) => s.id === "discovery:emerging:hot")!
    const big = out.find((s) => s.id === "discovery:emerging:big")!
    expect(hot.priority).toBe("important")
    expect(hot.confidence).toBe("high")
    expect(big.priority).toBe("study")
    expect(big.confidence).toBe("medium")
    expect(hot.subjects).toEqual([{ type: "product", id: "hot", label: "P hot" }])
  })

  it("the decision is measurable: paid orders of the product", () => {
    expect(metricForSignal("discovery:emerging:p_1")).toMatchObject({ metric: "paid_orders", scope: "product:p_1", direction: "up" })
  })

  it("synthesis: demand + quality → do not push; two demand detectors alone are ONE piece of evidence", () => {
    const rows = [row("hot", 15, 6), ...steady(50)]
    const em = emergingSignals(detectEmerging(rows, market(rows)), new Map(), ctx)
    const quality = { ...em[0], id: "risk:quality:product:hot", title: "Q" }
    const under = { ...em[0], id: "discovery:under-distributed:hot", title: "U" }
    expect(entitySynthesisSignals([...em, under], ctx)).toEqual([])
    const out = entitySynthesisSignals([...em, quality], ctx)
    expect(out[0].recommendedAction).toMatch(/Ne pas pousser/)
  })
})
