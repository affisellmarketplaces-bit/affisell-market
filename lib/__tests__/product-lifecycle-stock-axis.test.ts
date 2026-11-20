/**
 * Product lifecycle (founder decision 2026-11-18): publication (`isDraft`), commercial status (`active`) and
 * availability (`stock`, `lastStockStatus`) are independent. Stock sources and probes write availability ONLY:
 * out of stock never unpublishes, a technical failure never changes a status.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  alignTableVariantStocks,
  mergeVariantRowStocks,
  partnerStockUpdate,
  partnerStockValue,
  planPartnerStockWrite,
  emptyPartnerStockObservation,
  recordPartnerStockPlan,
  resolvePartnerStockSyncMode,
  resolveSupplierStockWrite,
  variantStockBaselineFromRows,
} from "@/lib/stock/partner-stock"

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

  it("planPartnerStockWrite: an unreadable value, variant rows or no change write nothing", () => {
    expect(planPartnerStockWrite("n/a", { stock: 5, variants: null })).toEqual({ action: "skip", reason: "unreadable" })
    expect(planPartnerStockWrite(null, { stock: 5, variants: null })).toEqual({ action: "skip", reason: "unreadable" })
    expect(planPartnerStockWrite(3, { stock: 5, variants: { variantRows: [{ id: "a", stock: 5 }] } })).toEqual({
      action: "skip",
      reason: "variant_rows",
    })
    expect(planPartnerStockWrite("5", { stock: 5, variants: null })).toEqual({ action: "skip", reason: "unchanged" })
    expect(planPartnerStockWrite(-2, { stock: 5, variants: null })).toEqual({ action: "write", stock: 0 })
    expect(planPartnerStockWrite(9, { stock: 5, variants: {} })).toEqual({ action: "write", stock: 9 })
  })

  it("the observation summary counts risky writes and skip reasons", () => {
    const o = emptyPartnerStockObservation()
    recordPartnerStockPlan(o, 8, { action: "write", stock: 0 })
    recordPartnerStockPlan(o, 0, { action: "write", stock: 4 })
    recordPartnerStockPlan(o, 5, { action: "write", stock: 40 })
    recordPartnerStockPlan(o, 100, { action: "write", stock: 95 })
    recordPartnerStockPlan(o, 3, { action: "skip", reason: "unreadable" })
    expect(o).toEqual({ wouldWrite: 4, toZero: 1, fromZero: 1, largeChange: 1, skipped: { unreadable: 1, variant_rows: 0, unchanged: 0 } })
  })

  it("the sync-stock mode is observe by default and writes only in enforce", () => {
    expect(resolvePartnerStockSyncMode({})).toBe("observe")
    expect(resolvePartnerStockSyncMode({ PARTNER_STOCK_SYNC_MODE: "enforce" })).toBe("enforce")
    const src = read("app/api/cron/sync-stock/route.ts")
    expect(src).toContain('if (mode === "observe")')
    expect(src).toContain("planPartnerStockWrite(")
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

describe("advanced SKU table: sold units are never resurrected, row by row", () => {
  const existing = [
    { id: "r1", name: "Rouge / M", stock: 4 }, // loaded 6, 2 sold since
    { id: "r2", name: "Bleu / M", stock: 10 },
  ]
  const baseline = variantStockBaselineFromRows([
    { id: "r1", stock: 6 },
    { id: "r2", stock: 10 },
  ])

  it("untouched rows keep the current stock; a changed row gets only the supplier's change", () => {
    const { rows, total } = mergeVariantRowStocks({
      existingRows: existing,
      incomingRows: [
        { id: "r1", name: "Rouge / M", stock: 6 }, // untouched in the form
        { id: "r2", name: "Bleu / M", stock: 15 }, // +5
      ],
      baseline,
    })
    expect(rows.map((r) => r.stock)).toEqual([4, 15])
    expect(total).toBe(19)
  })

  it("a new SKU row takes the submitted stock; extra fields are kept", () => {
    const { rows } = mergeVariantRowStocks({
      existingRows: existing,
      incomingRows: [{ id: "r3", name: "Vert / M", stock: 7, sku: "V-M" }],
      baseline,
    })
    expect(rows[0]).toEqual({ id: "r3", name: "Vert / M", stock: 7, sku: "V-M" })
  })

  it("rows without id match by name; without a baseline the submitted value is kept (legacy)", () => {
    const merged = mergeVariantRowStocks({
      existingRows: [{ name: "Unique", stock: 1 }],
      incomingRows: [{ name: "unique", stock: 3 }],
      baseline: { "name:unique": 3 },
    })
    expect(merged.rows[0]!.stock).toBe(1)
    expect(
      mergeVariantRowStocks({ existingRows: existing, incomingRows: [{ id: "r1", stock: 6 }], baseline: null }).rows[0]!
        .stock
    ).toBe(6)
  })

  it("baseline builder ignores unreadable rows", () => {
    expect(variantStockBaselineFromRows([{ id: "a", stock: "x" }, null, { name: "B", stock: 2.4 }])).toEqual({
      "name:b": 2,
    })
    expect(variantStockBaselineFromRows([])).toBeNull()
  })

  it("a row whose id changed (first saved as new-…, reloaded from the table) is matched by its name", () => {
    const merged = mergeVariantRowStocks({
      existingRows: [{ id: "new-abc", name: "Rouge / M", stock: 4 }], // loaded 6, 2 sold
      incomingRows: [{ id: "cuid_rouge_m", name: "Rouge / M", stock: 6 }],
      baseline: { "id:new-abc": 6 },
    })
    expect(merged.rows[0]!.stock).toBe(4)
  })

  it("a duplicated name is never guessed: the submitted value is kept", () => {
    const merged = mergeVariantRowStocks({
      existingRows: [
        { id: "a", name: "Rouge", stock: 1 },
        { id: "b", name: "Rouge", stock: 9 },
      ],
      incomingRows: [{ id: "z", name: "Rouge", stock: 5 }],
      baseline: { "id:a": 5 },
    })
    expect(merged.rows[0]!.stock).toBe(5)
  })

  it("the ProductVariant table rows take the merged stock of the same SKU, so Product.stock is not resurrected", () => {
    const label = (c: string, sz?: string | null) => (c && sz ? `${c} / ${sz}` : c || sz || "")
    const table = [
      { id: "cuid_rouge_m", color: "Rouge", size: "M", stock: 6 },
      { color: "Bleu", size: "M", stock: 15 },
      { id: "only_in_table", color: "Noir", size: null, stock: 3 },
    ]
    const mergedRows = [
      { id: "new-abc", name: "Rouge / M", stock: 4 },
      { id: "new-def", name: "Bleu / M", stock: 13 },
    ]
    const { rows, aligned } = alignTableVariantStocks(table, mergedRows, label)
    expect(rows.map((r) => r.stock)).toEqual([4, 13, 3])
    expect(aligned).toBe(2)
  })

  it("both supplier routes merge the rows and align the table", () => {
    const src = read("app/api/supplier/products/[id]/route.ts")
    expect(src.match(/mergeVariantRowStocks\(/g)?.length).toBe(2)
    expect(src.match(/alignTableVariantStocks\(/g)?.length).toBe(2)
  })
})
