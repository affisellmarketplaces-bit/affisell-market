import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { buildAvailabilityImpact } from "@/lib/supplier-catalog-health/availability-impact"
import { buildHealthReport, type HealthProduct } from "@/lib/supplier-catalog-health/diagnose"
import {
  restockCalculation,
  STALE_SHEET_DAYS,
  stockCover,
  type StockPositionInput,
} from "@/lib/supplier-catalog-health/stock-cover"

const now = new Date("2026-11-19T12:00:00Z")
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const pos = (over: Partial<StockPositionInput> = {}): StockPositionInput => ({
  declaredUnits: 10,
  confirmed: true,
  pendingUnits: 0,
  pendingDeductedByPlatform: false,
  units30d: 30,
  leadTimeDays: null,
  sheetUpdatedAt: daysAgo(2),
  now,
  ...over,
})

describe("stock cover — declared, confirmed, reserved and the estimate are never mixed", () => {
  it("judges on the declared figure and shows the reserved reading beside it, never instead", () => {
    const c = stockCover(pos({ pendingUnits: 4 }))
    expect(c).toMatchObject({ judged: true, daysOnDeclared: 10, daysIfReservedNotDeducted: 6, short: true, thresholdDays: 14 })
    // Deducted by the platform at payment: no second reading.
    expect(stockCover(pos({ pendingUnits: 4, pendingDeductedByPlatform: true })).daysIfReservedNotDeducted).toBeNull()
  })

  it("keeps 14 days as the indicative signal and raises it to a DECLARED lead time, never to an invented one", () => {
    expect(stockCover(pos({ declaredUnits: 20 })).short).toBe(false)
    expect(stockCover(pos({ declaredUnits: 20, leadTimeDays: 25 }))).toMatchObject({ thresholdDays: 25, short: true })
    expect(stockCover(pos({ declaredUnits: 20, leadTimeDays: 5 })).thresholdDays).toBe(14)
  })

  it("does not judge a thin pace, an unknown declared stock or nothing left", () => {
    expect(stockCover(pos({ units30d: 4 })).notJudgedReason).toBe("thin_pace")
    expect(stockCover(pos({ declaredUnits: null })).notJudgedReason).toBe("unknown_declared")
    expect(stockCover(pos({ declaredUnits: 0 })).notJudgedReason).toBe("nothing_left")
  })

  it("says when the sheet was not touched for long (a sheet date, not a stock confirmation)", () => {
    expect(stockCover(pos({ sheetUpdatedAt: daysAgo(STALE_SHEET_DAYS + 1) })).stale).toBe(true)
    expect(stockCover(pos({ sheetUpdatedAt: daysAgo(3) })).stale).toBe(false)
    expect(stockCover(pos({ sheetUpdatedAt: null })).sheetAgeDays).toBeNull()
  })
})

describe("restock calculation — explainable, never pre-filled or applied", () => {
  it("covers lead time + target at the observed pace, with a range from the count's own uncertainty", () => {
    const r = restockCalculation(pos({ leadTimeDays: 7 }))!
    expect(r).toMatchObject({ leadTimeSource: "declared", neededUnits: 37, availableUnits: 10, suggestedUnits: 27 })
    expect(r.lowUnits).toBeLessThan(r.suggestedUnits)
    expect(r.highUnits).toBeGreaterThan(r.suggestedUnits)
    expect(r.explanation.map((e) => e.code)).toEqual([
      "units_sold_30d",
      "lead_time_days",
      "target_cover_days",
      "needed_units",
      "available_units",
      "reserved_units",
    ])
  })

  it("says an undeclared lead time instead of inventing one, takes reserved units out only when not deducted, never goes negative", () => {
    expect(restockCalculation(pos())!.leadTimeSource).toBe("not_declared")
    expect(restockCalculation(pos({ pendingUnits: 4 }))!.availableUnits).toBe(6)
    expect(restockCalculation(pos({ pendingUnits: 4, pendingDeductedByPlatform: true }))!.availableUnits).toBe(10)
    expect(restockCalculation(pos({ declaredUnits: 500 }))!.suggestedUnits).toBe(0)
    expect(restockCalculation(pos({ units30d: 2 }))).toBeNull()
  })

  it("is attached only to quantity problems, with the stock position shown beside it", () => {
    const product = (over: Partial<HealthProduct>): HealthProduct => ({
      id: "p1",
      name: "Lampe",
      isDraft: false,
      active: true,
      listingKind: "PHYSICAL",
      basePriceCents: 2500,
      stock: 10,
      hasVariants: false,
      variantRowStocks: null,
      commissionExplicit: true,
      imageCount: 4,
      descriptionLength: 400,
      categoryId: "cat",
      hasGtin: true,
      deliveryMin: 2,
      deliveryMax: 5,
      safetyBlocking: [],
      holds: [],
      paidOrders30d: 20,
      units30d: 30,
      resellersListing: 3,
      createdAt: daysAgo(60),
      ...over,
    })
    const report = buildHealthReport([product({}), product({ id: "paused", active: false })], { now, readinessMode: "warn" })
    const sales = new Map([
      ["p1", { paidOrders30d: 20, units30d: 30, supplierAmount30dCents: 1000, lastPaidAt: daysAgo(1), position: pos() }],
      ["paused", { paidOrders30d: 20, units30d: 30, supplierAmount30dCents: 1000, lastPaidAt: daysAgo(1), position: pos() }],
    ])
    const impact = buildAvailabilityImpact(report.issues, sales, now)
    const cover = impact.items.find((i) => i.productId === "p1")!
    expect(cover.code).toBe("stock_cover_short")
    expect(cover.restock?.suggestedUnits).toBeGreaterThan(0)
    expect(cover.stock).toMatchObject({ declared: 10, confirmed: true, reserved: 0 })
    expect(impact.items.find((i) => i.productId === "paused")!.restock).toBeNull()
  })

  it("the panel never pre-fills the quantity field with the calculation", () => {
    const panel = readFileSync(path.join(path.resolve(__dirname, "../.."), "components/supplier/catalog-health-panel.tsx"), "utf8")
    expect(panel).toContain("RestockBlock")
    expect(panel).not.toMatch(/setValue\(\s*String\(\s*\w*\.?suggestedUnits/)
    expect(panel).toMatch(/useState\(""\)/)
  })
})
