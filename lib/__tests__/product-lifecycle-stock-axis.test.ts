/**
 * Product lifecycle (founder decision 2026-11-18): publication (`isDraft`), commercial status (`active`) and
 * availability (`stock`, `lastStockStatus`) are independent. Stock sources and probes write availability ONLY:
 * out of stock never unpublishes, a technical failure never changes a status.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { partnerStockUpdate, partnerStockValue, resolveSupplierStockWrite } from "@/lib/stock/partner-stock"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/ops-webhook", () => ({ opsWebhookAlert: async () => undefined }))

const root = path.resolve(__dirname, "../..")
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8")

describe("Ghost: technical failures touch availability only", () => {
  it("below the threshold nothing happens; at it, unknown + one alert; after it, stays unknown", async () => {
    const { ghostFailureEffect } = await import("@/lib/ghost/check-stock")
    expect(ghostFailureEffect(1)).toBe("none")
    expect(ghostFailureEffect(2)).toBe("none")
    expect(ghostFailureEffect(3)).toBe("mark_unknown_and_alert")
    expect(ghostFailureEffect(4)).toBe("keep_unknown")
    expect(ghostFailureEffect(40)).toBe("keep_unknown")
  })

  it("the probe never writes isDraft or active", () => {
    const src = read("lib/ghost/check-stock.ts")
    expect(src).not.toMatch(/isDraft\s*:/)
    expect(src).not.toMatch(/\bactive\s*:/)
  })
})

describe("partner stock sync: availability only", () => {
  it("normalises a partner count", () => {
    expect(partnerStockValue(12)).toBe(12)
    expect(partnerStockValue(3.9)).toBe(3)
    expect(partnerStockValue("7")).toBe(7)
    expect(partnerStockValue(-4)).toBe(0)
    expect(partnerStockValue(0)).toBe(0)
    expect(partnerStockValue(null)).toBe(0)
    expect(partnerStockValue("")).toBe(0)
    expect(partnerStockValue("n/a")).toBe(0)
    expect(partnerStockValue(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it("the update carries the stock and nothing else (no active, no isDraft)", () => {
    expect(partnerStockUpdate(0)).toEqual({ stock: 0 })
    expect(Object.keys(partnerStockUpdate(5))).toEqual(["stock"])
  })

  it("the sync-stock cron writes through partnerStockUpdate and never sets active", () => {
    const src = read("app/api/cron/sync-stock/route.ts")
    expect(src).toContain("partnerStockUpdate(")
    expect(src).not.toMatch(/\bactive\s*:/)
  })
})

describe("supplier form save: sold units are never resurrected", () => {
  it("an untouched stock field keeps the current stock (sales since the load are kept)", () => {
    // Loaded 10, 3 sold meanwhile (current 7), the supplier saved the title only.
    expect(resolveSupplierStockWrite({ current: 7, submitted: 10, baseline: 10 })).toBe(7)
  })

  it("a changed stock applies the supplier's change on top of the current stock", () => {
    // Loaded 10, 3 sold (7), supplier adds 5 (types 15) → 12.
    expect(resolveSupplierStockWrite({ current: 7, submitted: 15, baseline: 10 })).toBe(12)
    // Supplier lowers to 2 (−8) → never below 0.
    expect(resolveSupplierStockWrite({ current: 7, submitted: 2, baseline: 10 })).toBe(0)
  })

  it("without a baseline (legacy client) the submitted value is written, as before", () => {
    expect(resolveSupplierStockWrite({ current: 7, submitted: 10, baseline: undefined })).toBe(10)
    expect(resolveSupplierStockWrite({ current: 7, submitted: -3, baseline: null })).toBe(0)
  })

  it("an unreadable submitted stock keeps the current one", () => {
    expect(resolveSupplierStockWrite({ current: 7, submitted: "abc", baseline: 10 })).toBe(7)
    expect(resolveSupplierStockWrite({ current: 7, submitted: undefined, baseline: 10 })).toBe(7)
  })

  it("strings are read like numbers, rounded", () => {
    expect(resolveSupplierStockWrite({ current: 4, submitted: "6", baseline: "4" })).toBe(6)
    expect(resolveSupplierStockWrite({ current: 4, submitted: 5.6, baseline: 4 })).toBe(6)
  })

  it("both supplier write routes use the rule", () => {
    const src = read("app/api/supplier/products/[id]/route.ts")
    expect(src.match(/resolveSupplierStockWrite\(/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
