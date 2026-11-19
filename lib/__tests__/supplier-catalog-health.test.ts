import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  buildHealthReport,
  diagnoseProduct,
  HEALTH_ISSUE_CLASS,
  type HealthIssueCode,
  type HealthProduct,
} from "@/lib/supplier-catalog-health/diagnose"
import { resellerNextActions, supplierNextActions } from "@/lib/next-best-action/next-best-action"

const now = new Date("2026-11-19T12:00:00Z")
const ctx = { now, readinessMode: "warn" as const }
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)

function product(over: Partial<HealthProduct> = {}): HealthProduct {
  return {
    id: "p1",
    name: "Lampe en lin",
    isDraft: false,
    active: true,
    listingKind: "PHYSICAL",
    basePriceCents: 2_500,
    stock: 12,
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
    paidOrders30d: 3,
    resellersListing: 2,
    createdAt: daysAgo(60),
    ...over,
  }
}
const codes = (p: HealthProduct, mode: "off" | "warn" | "enforce" = "warn") =>
  diagnoseProduct(p, { now, readinessMode: mode }).map((i) => i.code)

describe("supplier catalogue health — classes are what they claim", () => {
  it("a complete product on sale has nothing to report", () => {
    expect(codes(product())).toEqual([])
  })

  it("blocages are only things that really prevent an operation", () => {
    expect(codes(product({ basePriceCents: 0 }))).toContain("price_missing")
    expect(codes(product({ commissionExplicit: false }))).toContain("commission_not_explicit")
    expect(codes(product({ stock: 0 }))).toContain("out_of_stock")
    expect(codes(product({ holds: ["product_recalled"] }))).toContain("held_by_affisell")
    // a held product is not ALSO reported as out of stock / unsold: the hold explains it
    expect(codes(product({ holds: ["product_suspended"], stock: 0 }))).toEqual(["held_by_affisell"])
  })

  it("missing safety data blocks only when the control is enforced on a draft — otherwise a warning", () => {
    const missing = { safetyBlocking: ["gpsr_manufacturer_name_missing"] }
    expect(codes(product({ ...missing, isDraft: true }), "enforce")).toContain("safety_blocks_publication")
    expect(codes(product({ ...missing, isDraft: true }), "warn")).toContain("safety_data_missing")
    // already live: never blocked (edits of live listings are never refused)
    expect(codes(product(missing), "enforce")).toContain("safety_data_missing")
    expect(codes(product(missing), "enforce")).not.toContain("safety_blocks_publication")
  })

  it("an unreadable hold is never read as « no hold »", () => {
    expect(codes(product({ holds: null }))).toContain("hold_unverifiable")
  })

  it("nominal stocks are anomalies, a real quantity is not", () => {
    for (const s of [99, 999, 9999]) expect(codes(product({ stock: s }))).toContain("stock_nominal")
    expect(codes(product({ stock: 98 }))).not.toContain("stock_nominal")
  })

  it("variant stock: mismatch and untracked", () => {
    expect(codes(product({ variantRowStocks: [2, 3], stock: 9 }))).toContain("variant_stock_mismatch")
    expect(codes(product({ variantRowStocks: [2, 3], stock: 5 }))).not.toContain("variant_stock_mismatch")
    expect(codes(product({ hasVariants: true, variantRowStocks: null }))).toContain("variant_stock_untracked")
    expect(codes(product({ variantRowStocks: [0, 0], stock: 0 }))).toContain("out_of_stock")
  })

  it("non-physical listings are never asked for stock", () => {
    const c = codes(product({ listingKind: "SERVICE", stock: 0, hasGtin: false, safetyBlocking: null }))
    expect(c).not.toContain("out_of_stock")
    expect(c).not.toContain("no_gtin")
  })

  it("selling problems need time before being reported", () => {
    expect(codes(product({ resellersListing: 0, createdAt: daysAgo(20) }))).toContain("no_reseller")
    expect(codes(product({ resellersListing: 0, createdAt: daysAgo(5) }))).not.toContain("no_reseller")
    expect(codes(product({ paidOrders30d: 0, resellersListing: 2, createdAt: daysAgo(40) }))).toContain("listed_no_sales")
    expect(codes(product({ paidOrders30d: 0, resellersListing: 2, createdAt: daysAgo(10) }))).not.toContain("listed_no_sales")
  })

  it("recommendations are optional improvements, and a complete draft is offered, never forced", () => {
    expect(codes(product({ imageCount: 2, descriptionLength: 50, hasGtin: false }))).toEqual(
      expect.arrayContaining(["few_photos", "short_description", "no_gtin"])
    )
    expect(codes(product({ isDraft: true }))).toContain("draft_ready")
    expect(codes(product({ isDraft: true, stock: 0 }))).not.toContain("draft_ready")
  })

  it("ranks by observed demand within the class weights; duplicates are found by normalised name", () => {
    const r = buildHealthReport(
      [
        product({ id: "a", name: "Bougie Été", stock: 0, paidOrders30d: 0, resellersListing: 0 }),
        product({ id: "b", name: "Lampe", stock: 0, paidOrders30d: 10, resellersListing: 4 }),
        product({ id: "c", name: "bougie ete", imageCount: 2 }),
      ],
      ctx
    )
    expect(r.issues[0]).toMatchObject({ productId: "b", code: "out_of_stock", cls: "blocage" })
    expect(r.issues.filter((i) => i.code === "duplicate_name").map((i) => i.productId).sort()).toEqual(["a", "c"])
    expect(r.blockedProducts).toBe(2)
    expect(r.counts.blocage).toBe(2)
  })
})

describe("next best action", () => {
  it("supplier: at most three, distinct kinds, never an action the supplier can not take", () => {
    const r = buildHealthReport(
      [
        product({ id: "held", name: "Rappel", holds: ["product_recalled"], paidOrders30d: 50 }),
        product({ id: "a", name: "A", stock: 0, paidOrders30d: 5 }),
        product({ id: "b", name: "B", commissionExplicit: false, paidOrders30d: 2 }),
        product({ id: "c", name: "C", resellersListing: 0, paidOrders30d: 0, createdAt: daysAgo(30) }),
        product({ id: "d", name: "D", isDraft: true, paidOrders30d: 0, resellersListing: 0 }),
      ],
      ctx
    )
    const actions = supplierNextActions(r)
    expect(actions.length).toBeLessThanOrEqual(3)
    expect(new Set(actions.map((a) => a.kind)).size).toBe(actions.length)
    expect(actions.map((a) => a.productId)).not.toContain("held")
    expect(actions[0]).toMatchObject({ kind: "resolve_availability", productId: "a", priority: "haute" })
    for (const a of actions) expect(a.impact.qualification).toBe("potentiel")
  })

  it("supplier: no generic advice — optional polish without demand is not an action", () => {
    const r = buildHealthReport([product({ imageCount: 1, paidOrders30d: 0, resellersListing: 0, createdAt: daysAgo(3) })], ctx)
    expect(supplierNextActions(r)).toEqual([])
  })

  it("reseller: an unsellable listing first, then a profit drop, then a ready product", () => {
    const actions = resellerNextActions({
      listings: [
        { listingId: "l1", productId: "x", name: "X", problem: null, paidOrders30d: 9 },
        { listingId: "l2", productId: "y", name: "Y", problem: "out_of_stock", paidOrders30d: 3 },
      ],
      drops: [{ alertId: "a", productId: "z", name: "Z", primaryCause: "supplier_price_up", netChangeCents: -6_000 }],
      ready: [{ productId: "w", name: "W", netPerSaleCents: 850, paidOrders30d: 4, resellersListing: 1 }],
    })
    expect(actions.map((a) => a.kind)).toEqual(["fix_shop_listing", "review_profit_drop", "add_ready_product"])
    expect(actions[0]).toMatchObject({ reason: "shop_out_of_stock", href: "/dashboard/affiliate/products/l2/edit" })
    expect(actions[1]).toMatchObject({ reason: "drop_supplier_price_up", priority: "haute" })
  })

  it("reseller: unknown causes are named generically, never as a raw code", () => {
    const [a] = resellerNextActions({ listings: [], drops: [{ alertId: "a", productId: "z", name: "Z", primaryCause: "whatever", netChangeCents: -100 }], ready: [] })
    expect(a.reason).toBe("drop_other")
  })
})

describe("wiring", () => {
  const root = path.resolve(__dirname, "../..")
  const read = (f: string) => readFileSync(path.join(root, f), "utf8")

  it("every diagnosis and action has its text in the 8 locales", () => {
    const reasons = [
      ...Object.keys(HEALTH_ISSUE_CLASS).filter((c) => c !== "held_by_affisell" && c !== "hold_unverifiable"),
      ...["out_of_stock", "product_unavailable", "awaiting_review", "no_commission"].map((p) => `shop_${p}`),
      ...["volume_down", "your_price_down", "collected_price_down", "supplier_price_up", "commission_down", "fees_up", "refunds_up", "disputes_up", "other"].map((c) => `drop_${c}`),
      "ready_to_sell",
    ]
    for (const loc of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
      const m = JSON.parse(read(`messages/${loc}.json`))
      for (const code of Object.keys(HEALTH_ISSUE_CLASS) as HealthIssueCode[]) {
        expect(m.catalogHealth.issues[code]?.title, `${loc} ${code}`).toBeTruthy()
        expect(m.catalogHealth.issues[code]?.why, `${loc} ${code}`).toBeTruthy()
      }
      for (const r of reasons) {
        // supplier-only codes that never become actions may lack a reason line
        if (["listed_no_sales", "few_photos"].includes(r) && !m.nextActions.reason[r]) continue
        expect(m.nextActions.reason[r], `${loc} reason ${r}`).toBeTruthy()
      }
    }
  })

  it("routes are scoped to their own role and read-only", () => {
    const health = read("app/api/supplier/catalog-health/route.ts")
    expect(health).toContain('session.user.role !== "SUPPLIER"')
    expect(health).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/)
    expect(read("app/api/supplier/next-actions/route.ts")).toContain('session.user.role !== "SUPPLIER"')
    expect(read("app/api/affiliate/next-actions/route.ts")).toContain('session.user.role !== "AFFILIATE"')
    const loader = read("lib/supplier-catalog-health/diagnose.server.ts")
    expect(loader).toContain("where: { supplierId }")
    expect(loader).not.toMatch(/\.(create|update|upsert|delete)(Many)?\(/)
    expect(read("lib/next-best-action/next-best-action.server.ts")).not.toMatch(/\.(create|update|upsert|delete)(Many)?\(/)
  })
})
