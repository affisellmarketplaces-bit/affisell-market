/**
 * Founder brief 2026-11-19 « Intelligence de stock par déclinaison »: a sufficient total never hides a sold-out variant;
 * the total is never split; unmatched orders are counted apart; resellers are counts only, from 2.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { analyzeVariantStock, variantStockWorthShowing, type VariantProductInput } from "@/lib/supplier-catalog-health/variant-stockout"

const now = new Date("2026-11-19T06:00:00Z")
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000)
const base: VariantProductInput = {
  productId: "p",
  productName: "T-shirt",
  liveListings: 4,
  hasVariants: true,
  variants: { variantRows: [{ name: "Noir / M", stock: 0 }, { name: "Noir / L", stock: 40 }, { name: "Noir / S", stock: 2 }] },
  reservedByLabel: [],
  reservedAlreadyDeducted: false,
  orders: [
    ...Array.from({ length: 20 }, (_, i) => ({ variantLabel: "Noir · M", paidAt: ago(i + 1), quantity: 1, affiliateId: i % 2 ? "a" : "b" })),
    ...Array.from({ length: 5 }, (_, i) => ({ variantLabel: "Noir · L", paidAt: ago(i + 40), quantity: 1, affiliateId: "a" })),
    { variantLabel: "Rouge", paidAt: ago(1), quantity: 2, affiliateId: "c" },
  ],
  confirmedAt: ago(2),
  unconfirmedMarker: false,
  sheetUpdatedAt: ago(2),
  leadTimeDays: 10,
  now,
}

describe("stock per variant", () => {
  it("a sufficient total does not hide a sold-out variant: partial stock-out, its observed share of sales", () => {
    const r = analyzeVariantStock(base)
    expect(r.mode).toBe("rows")
    expect(r.partialStockout).toBe(true)
    expect(r.blockedVariants).toBe(1)
    const m = r.variants.find((v) => v.label === "Noir / M")!
    expect(m).toMatchObject({ available: false, units90d: 20, salesSharePct: 80, sellingResellers: 2 })
    expect(variantStockWorthShowing(r)).toBe(true)
  })

  it("orders whose variant matches no row are counted apart, never spread", () => {
    expect(analyzeVariantStock(base).unattributedUnits90d).toBe(2)
  })

  it("resellers are counts only, hidden below 2", () => {
    const l = analyzeVariantStock(base).variants.find((v) => v.label === "Noir / L")!
    expect(l.sellingResellers).toBeNull()
    expect(l.sellingResellersBelowThreshold).toBe(true)
  })

  it("variants kept only in the variant table: the whole product is « non évaluable », the total is never split", () => {
    const r = analyzeVariantStock({ ...base, variants: null })
    expect(r.mode).toBe("variants_not_tracked")
    expect(r.variants).toEqual([])
    expect(r.unattributedUnits90d).toBe(27)
  })

  it("two rows sharing a name are ambiguous: nothing is tied to them", () => {
    const r = analyzeVariantStock({ ...base, variants: { variantRows: [{ name: "Noir / M", stock: 3 }, { name: "noir / m", stock: 0 }] } })
    expect(r.variants.every((v) => v.ambiguous && v.forecast === null)).toBe(true)
    expect(r.partialStockout).toBe(false)
  })

  it("reservations per variant are subtracted once, only when the platform does not already deduct them", () => {
    const rows = { variantRows: [{ name: "Noir / M", stock: 5 }, { name: "Noir / L", stock: 40 }] }
    const orders = Array.from({ length: 20 }, (_, i) => ({ variantLabel: "Noir · M", paidAt: ago(i + 1), quantity: 1, affiliateId: "a" }))
    const notDeducted = analyzeVariantStock({ ...base, variants: rows, orders, reservedByLabel: [{ variantLabel: "Noir · M", units: 5 }] })
    expect(notDeducted.variants.find((v) => v.label === "Noir / M")!.available).toBe(false)
    const deducted = analyzeVariantStock({ ...base, variants: rows, orders, reservedByLabel: [{ variantLabel: "Noir · M", units: 5 }], reservedAlreadyDeducted: true })
    const m = deducted.variants.find((v) => v.label === "Noir / M")!
    expect(m.available).toBe(true)
    expect(m.forecast!.risk).toBe("probable")
    expect(deducted.variantsAtRisk).toBe(1)
  })

  it("never claims a lost sale and never names a reseller", () => {
    const src = readFileSync(path.resolve(__dirname, "../supplier-catalog-health/variant-stockout.ts"), "utf8")
    expect(src).not.toMatch(/lostSales|lost_sales|missedSales/)
    expect(JSON.stringify(analyzeVariantStock(base))).not.toMatch(/"a"|"b"|"c"/)
  })
})
