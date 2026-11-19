/**
 * Founder brief 2026-11-19 — the supplier's « N buyers are waiting for this variant » signal, built from the buyers'
 * explicit restock requests. Pure rules, the real loader on an in-memory database (both ways of holding variants),
 * the supplier route's access rights, the absence of personal data, the observation report and the 8 locales.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { aggregateRestockDemand, RESTOCK_DEMAND_MIN_BUYERS, type WatchedVariantToday } from "@/lib/restock-watch/restock-demand"
import { summarizeRestockObservations, type RestockWatch } from "@/lib/restock-watch/restock-watch"

const now = new Date("2026-11-20T10:00:00Z")
const watch = (userId: string, over: Partial<RestockWatch> = {}): RestockWatch => ({
  userId,
  listingId: "l1",
  productId: "p1",
  variantKey: "noir|m||",
  variantLabel: "Noir / M",
  locale: "fr",
  state: "active",
  episode: 1,
  requestedAt: "2026-11-19T10:00:00Z",
  updatedAt: "2026-11-19T10:00:00Z",
  ...over,
})
const soldOut = (): WatchedVariantToday => ({ status: "sold_out", label: "Noir / M" })

describe("aggregateRestockDemand — pure rules", () => {
  it("shown only from 3 DISTINCT buyers; below that nothing at all is said", () => {
    expect(aggregateRestockDemand({ watches: [watch("a"), watch("b")], now, variantToday: soldOut })).toEqual([])
    expect(aggregateRestockDemand({ watches: [watch("a"), watch("b"), watch("c")], now, variantToday: soldOut })).toEqual([
      { productId: "p1", variantKey: "noir|m||", variantLabel: "Noir / M", buyers: 3 },
    ])
    expect(RESTOCK_DEMAND_MIN_BUYERS).toBe(3)
    // A caller can never lower the threshold.
    expect(aggregateRestockDemand({ watches: [watch("a")], now, variantToday: soldOut, minBuyers: 1 })).toEqual([])
  })

  it("one buyer asking several times (two shops of the same product) counts once", () => {
    const ws = [watch("a"), watch("a", { listingId: "l2" }), watch("a", { listingId: "l3" }), watch("b"), watch("b", { listingId: "l2" })]
    expect(aggregateRestockDemand({ watches: ws, now, variantToday: soldOut })).toEqual([])
    expect(aggregateRestockDemand({ watches: [...ws, watch("c")], now, variantToday: soldOut })[0]!.buyers).toBe(3)
  })

  it("never adds sizes or colours together", () => {
    const ws = [watch("a"), watch("b"), watch("c", { variantKey: "noir|l||" }), watch("d", { variantKey: "blanc|m||" })]
    expect(aggregateRestockDemand({ watches: ws, now, variantToday: () => ({ status: "sold_out", label: "x" }) })).toEqual([])
  })

  it("only active, unexpired requests on a variant that is still sold out", () => {
    const three = [watch("a"), watch("b"), watch("c")]
    for (const state of ["cancelled", "notified", "closed", "expired"] as const) {
      expect(aggregateRestockDemand({ watches: [watch("a"), watch("b"), watch("c", { state })], now, variantToday: soldOut })).toEqual([])
    }
    const old = [watch("a"), watch("b"), watch("c", { requestedAt: "2026-07-01T00:00:00Z" })]
    expect(aggregateRestockDemand({ watches: old, now, variantToday: soldOut })).toEqual([])
    for (const status of ["available", "gone", "ambiguous", "unknown"] as const) {
      expect(aggregateRestockDemand({ watches: three, now, variantToday: () => ({ status }) })).toEqual([])
    }
  })

  it("the output carries no buyer, date, shop or episode", () => {
    const out = JSON.stringify(aggregateRestockDemand({ watches: [watch("user-alice"), watch("user-bob"), watch("user-carol", { listingId: "shop-x" })], now, variantToday: soldOut }))
    for (const leak of ["user-alice", "user-bob", "user-carol", "shop-x", "l1", "2026-11-19", "requestedAt", "episode", "locale"]) expect(out).not.toContain(leak)
  })
})

describe("summarizeRestockObservations — theoretical and real counts never mixed", () => {
  it("keeps would-notify (markers) and sent (claims) in separate columns", () => {
    const r = summarizeRestockObservations({
      snapshots: [{ day: "2026-11-20", payload: { mode: "observe", active: 12, activeBuyers: 9, activeVariants: 5 } }],
      observedMarkerDays: ["2026-11-20", "2026-11-20", "2026-11-21"],
      sentClaimDays: [],
    })
    expect(r.totals).toEqual({ wouldNotifyNew: 3, sent: 0 })
    expect(r.days[0]).toEqual({ day: "2026-11-20", snapshot: { mode: "observe", active: 12, activeBuyers: 9, activeVariants: 5 }, wouldNotifyNew: 2, sent: 0 })
    expect(r.reading).toBe("too_few_days")
    expect(summarizeRestockObservations({ snapshots: [], observedMarkerDays: [], sentClaimDays: [] }).reading).toBe("no_data")
  })
})

// ---------- the real loader, on an in-memory database ----------
const db = vi.hoisted(() => ({
  products: [] as Array<Record<string, unknown>>,
  listings: [] as Array<{ id: string; productId: string }>,
  audit: [] as Array<{ action: string; entityId: string; payload: unknown }>,
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findMany: async ({ where }: { where: { supplierId: string } }) => db.products.filter((p) => p.supplierId === where.supplierId) },
    affiliateProduct: { findMany: async ({ where }: { where: { productId: { in: string[] } } }) => db.listings.filter((l) => where.productId.in.includes(l.productId)) },
    auditLog: {
      findMany: async ({ where }: { where: { action: string; entityId: { in: string[] } } }) =>
        db.audit.filter((a) => a.action === where.action && where.entityId.in.includes(a.entityId) && (a.payload as { state?: string }).state === "active"),
    },
  },
}))
const authState = vi.hoisted(() => ({ session: null as null | { user: { id: string; role: string } } }))
vi.mock("@/auth", () => ({ auth: async () => authState.session }))
vi.mock("@/lib/api-rate-limit", () => ({ rateLimitClientKey: () => "k", rateLimitResponseAsync: async () => null }))

import { loadSupplierRestockDemand } from "@/lib/restock-watch/restock-demand.server"
import { GET as supplierRoute } from "@/app/api/supplier/restock-demand/route"

const rowsProduct = (stockM: number) => ({
  id: "p1",
  supplierId: "s1",
  name: "T-shirt",
  variants: { variantRows: [{ name: "Noir / M", stock: stockM, attrs: {} }, { name: "Noir / L", stock: 2, attrs: {} }] },
  customColumns: null,
  productVariants: [],
})
const tableProduct = (stockM: number) => ({
  id: "p2",
  supplierId: "s1",
  name: "Sweat",
  variants: null,
  customColumns: null,
  productVariants: [
    { color: "Gris", size: "M", stock: stockM, customData: null },
    { color: "Gris", size: "L", stock: 1, customData: null },
  ],
})
const req = (userId: string, listingId: string, variantKey: string, state = "active") => ({
  action: "buyer.restock_watch",
  entityId: listingId,
  payload: { ...watch(userId, { listingId, variantKey, productId: "stale-or-forged" }), state },
})

beforeEach(() => {
  db.products = [rowsProduct(0), tableProduct(0), { ...rowsProduct(0), id: "p9", supplierId: "other" }]
  db.listings = [
    { id: "l1", productId: "p1" },
    { id: "l2", productId: "p1" },
    { id: "t1", productId: "p2" },
    { id: "x1", productId: "p9" },
  ]
  db.audit = [
    req("a", "l1", "noir|m||"),
    req("a", "l2", "noir|m||"), // same buyer, second shop
    req("b", "l2", "noir|m||"),
    req("c", "l1", "noir|m||"),
    req("d", "l1", "noir|l||"), // another size: never added
    req("a", "t1", "gris|m||"),
    req("b", "t1", "gris|m||"),
    req("c", "t1", "gris|m||"),
    req("e", "t1", "gris|m||", "cancelled"),
    req("a", "x1", "noir|m||"),
    req("b", "x1", "noir|m||"),
    req("c", "x1", "noir|m||"), // another supplier's product
  ]
  authState.session = null
})

describe("loadSupplierRestockDemand — both ways of holding variants", () => {
  it("counts distinct buyers per exact variant, advanced rows AND table variants, own products only", async () => {
    const r = await loadSupplierRestockDemand("s1", now)
    expect(r.products.map((p) => p.productId).sort()).toEqual(["p1", "p2"])
    expect(r.products.find((p) => p.productId === "p1")!.variants).toEqual([{ productId: "p1", variantKey: "noir|m||", variantLabel: "Noir / M", buyers: 3 }])
    expect(r.products.find((p) => p.productId === "p2")!.variants).toEqual([{ productId: "p2", variantKey: "gris|m||", variantLabel: "Gris / M", buyers: 3 }])
    expect(JSON.stringify(r)).not.toMatch(/"(a|b|c|d|e)"|l1|l2|t1|x1|stale-or-forged|requestedAt/)
  })

  it("the count disappears as soon as the variant is back in stock", async () => {
    db.products = [rowsProduct(4), tableProduct(0)]
    const r = await loadSupplierRestockDemand("s1", now)
    expect(r.products.map((p) => p.productId)).toEqual(["p2"])
    db.products = [rowsProduct(4), tableProduct(2)]
    expect((await loadSupplierRestockDemand("s1", now)).products).toEqual([])
  })

  it("an expired request no longer counts, even before the cron closes it", async () => {
    expect((await loadSupplierRestockDemand("s1", new Date("2027-03-01T00:00:00Z"))).products).toEqual([])
  })
})

describe("GET /api/supplier/restock-demand — access", () => {
  const call = () => supplierRoute(new Request("http://localhost/api/supplier/restock-demand"))
  it("401 signed out, 403 for any role but SUPPLIER", async () => {
    expect((await call()).status).toBe(401)
    for (const role of ["AFFILIATE", "CUSTOMER", "ADMIN"]) {
      authState.session = { user: { id: "s1", role } }
      expect((await call()).status).toBe(403)
    }
  })
  it("a supplier only ever reads its own products", async () => {
    authState.session = { user: { id: "other", role: "SUPPLIER" } }
    const j = (await (await call()).json()) as { products: Array<{ productId: string }> }
    expect(j.products.map((p) => p.productId)).toEqual(["p9"])
  })
})

describe("translations — 8 locales", () => {
  const locales = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]
  const read = (l: string) => JSON.parse(readFileSync(join(process.cwd(), "messages", `${l}.json`), "utf8"))
  const restockKeys = ["cta", "watching", "hint", "hintNotActive", "saved", "savedNotActive", "cancelled", "pushDenied", "pushUnsupported", "availableNow", "tooMany", "error", "signInPrompt", "signIn", "pushTitle", "pushBody"]
  const demandKeys = ["title", "subtitle", "buyers", "fix", "truncated", "disclaimer"]
  for (const l of locales) {
    it(`${l}: every key present and non-empty, placeholders kept, no restock date promised`, () => {
      const m = read(l)
      for (const k of restockKeys) expect(String(m.restockWatch[k] ?? "").trim(), `${l}.restockWatch.${k}`).not.toBe("")
      for (const k of demandKeys) expect(String(m.catalogHealth.restockDemand[k] ?? "").trim(), `${l}.restockDemand.${k}`).not.toBe("")
      expect(m.catalogHealth.variantStock.waitingBuyers).toContain("{count")
      expect(m.catalogHealth.restockDemand.buyers).toContain("{count")
      expect(m.catalogHealth.restockDemand.subtitle).toContain("{min}")
      expect(m.restockWatch.pushTitle).toContain("{product}")
      expect(m.restockWatch.pushBody).toContain("{variant}")
    })
  }
})
