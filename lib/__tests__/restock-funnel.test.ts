/**
 * Founder brief 2026-11-20 — from explicit buyer demand to a restock, and what followed. The pure episode state machine
 * (a quantity change is not a return), purchases after the return (distinct orders, refunds apart, association only),
 * the decision indicators, the next-best-action recommendation, then the REAL tracking + read on an in-memory database
 * (two shops, repeated requests, return, new stock-out, refund), access scoping, privacy and the 8 locales.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { supplierNextActions } from "@/lib/next-best-action/next-best-action"
import {
  nextDemandEpisode,
  purchasesAfterReturn,
  summarizeDemandFunnel,
  episodeView,
  type DemandEpisode,
  type DemandObservation,
  type OrderFact,
} from "@/lib/restock-watch/restock-funnel"

const t0 = new Date("2026-11-20T10:00:00Z")
const at = (days: number) => new Date(t0.getTime() + days * 86_400_000)
const obs = (over: Partial<DemandObservation> = {}): DemandObservation => ({
  now: t0,
  productId: "p1",
  variantKey: "noir|m||",
  variantLabel: "Noir / M",
  waitingBuyers: 3,
  variant: { status: "found", stock: 0 },
  listingExists: true,
  listed: true,
  sellable: true,
  productUpdatedAt: null,
  lapsed: { expired: 0, cancelled: 0 },
  ...over,
})
const opened = (): DemandEpisode => nextDemandEpisode(null, obs()).episode!

describe("demand episode — the state machine", () => {
  it("opens only at 3 distinct buyers on a variant that is sold out and still listed somewhere", () => {
    expect(nextDemandEpisode(null, obs({ waitingBuyers: 2 })).event).toBe("none")
    expect(nextDemandEpisode(null, obs({ variant: { status: "found", stock: 1 } })).event).toBe("none")
    expect(nextDemandEpisode(null, obs({ listingExists: false })).event).toBe("none")
    expect(nextDemandEpisode(null, obs({ variant: { status: "ambiguous" } })).event).toBe("none")
    const t = nextDemandEpisode(null, obs({ waitingBuyers: 4 }))
    expect(t).toMatchObject({ event: "opened", episode: { stage: "waiting", buyersAtOpen: 4, peakBuyers: 4, backAt: null } })
  })

  it("a quantity change that does not make the variant buyable is NOT a return", () => {
    const e = opened()
    const t = nextDemandEpisode(e, obs({ now: at(1), variant: { status: "found", stock: 5 }, sellable: false }))
    expect(t.event).toBe("updated")
    expect(t.episode).toMatchObject({ stage: "waiting", stockSeenAt: at(1).toISOString(), backAt: null })
    expect(nextDemandEpisode(e, obs({ now: at(1), variant: { status: "found", stock: 5 }, listed: false })).episode!.backAt).toBeNull()
  })

  it("a real return records units and buyers waiting; fewer units than buyers is flagged in the summary", () => {
    const t = nextDemandEpisode(opened(), obs({ now: at(4), variant: { status: "found", stock: 2 }, waitingBuyers: 5 }))
    expect(t).toMatchObject({ event: "returned", episode: { stage: "back", unitsAtBack: 2, buyersAtBack: 5, backAt: at(4).toISOString() } })
    const v = episodeView(t.episode!, { ordersAfterReturn: 0, unitsAfterReturn: 0, refundedOrCancelled: 0, byWaitingBuyers: 0, notificationsSent: 0, notificationsTheoretical: 0 }, at(5))
    expect(v.daysToReturn).toBe(4)
    expect(summarizeDemandFunnel([v]).partialReturns).toBe(1)
  })

  it("a return followed by a new stock-out is recorded, not a new episode; the follow-up closes after 30 days", () => {
    const back = nextDemandEpisode(opened(), obs({ now: at(2), variant: { status: "found", stock: 3 } })).episode!
    const again = nextDemandEpisode(back, obs({ now: at(6), variant: { status: "found", stock: 0 } }))
    expect(again).toMatchObject({ event: "updated", episode: { stage: "back", resoldOutAt: at(6).toISOString() } })
    expect(nextDemandEpisode(again.episode, obs({ now: at(33), variant: { status: "found", stock: 0 } }))).toMatchObject({ event: "closed", episode: { closeReason: "follow_up_done" } })
  })

  it("demand that lapses (expired / cancelled) closes without a return, with the counts", () => {
    const t = nextDemandEpisode(opened(), obs({ now: at(3), waitingBuyers: 1, lapsed: { expired: 1, cancelled: 1 } }))
    expect(t).toMatchObject({ event: "closed", episode: { stage: "closed", closeReason: "demand_dropped", droppedBy: { expired: 1, cancelled: 1 }, backAt: null } })
  })

  it("variant removed / every listing removed close the episode; an unreadable product changes nothing", () => {
    expect(nextDemandEpisode(opened(), obs({ variant: { status: "gone" } })).episode!.closeReason).toBe("variant_removed")
    expect(nextDemandEpisode(opened(), obs({ listingExists: false })).episode!.closeReason).toBe("listing_removed")
    const e = opened()
    expect(nextDemandEpisode(e, obs({ variant: { status: "unknown" }, waitingBuyers: 0 }))).toEqual({ episode: e, event: "none" })
  })

  it("the product sheet modified after the demand is a supplier action, recorded once — not a return", () => {
    const e = nextDemandEpisode(opened(), obs({ now: at(1), productUpdatedAt: at(1) })).episode!
    expect(e).toMatchObject({ sheetModifiedAt: at(1).toISOString(), stage: "waiting" })
    expect(nextDemandEpisode(e, obs({ now: at(2), productUpdatedAt: at(2) })).episode!.sheetModifiedAt).toBe(at(1).toISOString())
  })

  it("a closed episode never reopens; a new demand opens a new one", () => {
    const closed = nextDemandEpisode(opened(), obs({ waitingBuyers: 0 })).episode!
    expect(nextDemandEpisode(closed, obs({ now: at(10) }))).toMatchObject({ event: "opened", episode: { openedAt: at(10).toISOString() } })
  })
})

describe("purchases after the return — association, never causation", () => {
  const back = nextDemandEpisode(opened(), obs({ now: at(2), variant: { status: "found", stock: 3 } })).episode!
  const order = (id: string, day: number, over: Partial<OrderFact> = {}): OrderFact => ({ id, paidAt: at(day), quantity: 1, variantMatches: true, closed: false, buyerUserId: null, ...over })

  it("distinct orders of THIS variant inside the 30-day window; refunds and cancellations counted apart", () => {
    const r = purchasesAfterReturn(
      back,
      [order("o1", 3), order("o1", 3), order("o2", 4, { quantity: 2, closed: true }), order("o3", 5, { variantMatches: false }), order("o4", 1), order("o5", 40), order("o6", 6, { buyerUserId: "u-waiting" })],
      new Set(["u-waiting"])
    )
    expect(r).toEqual({ ordersAfterReturn: 3, unitsAfterReturn: 4, refundedOrCancelled: 1, byWaitingBuyers: 1 })
  })

  it("no return = nothing to measure; an order that can not be tied to the variant makes the whole count not evaluable", () => {
    expect(purchasesAfterReturn(opened(), [order("o1", 3)], new Set()).ordersAfterReturn).toBeNull()
    expect(purchasesAfterReturn(back, [order("o1", 3, { variantMatches: null })], new Set()).ordersAfterReturn).toBeNull()
  })
})

describe("next best action — « N buyers are waiting for Noir / M »", () => {
  const health = {
    issues: [
      {
        code: "out_of_stock",
        cls: "blocage",
        productId: "p1",
        productName: "T-shirt",
        evidence: {},
        source: "fiche",
        demand: { paidOrders30d: 2, resellersListing: 1 },
        impactScore: 50,
      },
    ],
  } as never
  const demand = [{ productId: "p1", productName: "T-shirt", variants: [{ productId: "p1", variantKey: "noir|m||", variantLabel: "Noir / M", buyers: 5 }] }]

  it("names the exact variant and the distinct-buyer count, points at the stock, replaces the generic availability action", () => {
    const actions = supplierNextActions(health, 3, demand)
    expect(actions[0]).toMatchObject({
      kind: "answer_restock_demand",
      key: "answer_restock_demand:p1:noir|m||",
      variantLabel: "Noir / M",
      impact: { qualification: "potentiel", waitingBuyers: 5 },
      href: "/dashboard/supplier/products/p1/edit",
      priority: "haute",
    })
    expect(actions.some((a) => a.kind === "resolve_availability" && a.productId === "p1")).toBe(false)
    // Never a sales or revenue promise: no money, no order forecast in the action.
    expect(actions[0]!.impact).not.toHaveProperty("netPerSaleCents")
    expect(actions[0]!.impact).not.toHaveProperty("paidOrders30d")
  })

  it("disappears with the demand, and the same demand keeps the same key (no repeated recommendation)", () => {
    expect(supplierNextActions(health, 3, []).some((a) => a.kind === "answer_restock_demand")).toBe(false)
    expect(supplierNextActions(health, 3, [])[0]).toMatchObject({ kind: "resolve_availability" })
    expect(supplierNextActions(health, 3, demand)[0]!.key).toBe(supplierNextActions(health, 3, demand)[0]!.key)
    const below = [{ ...demand[0]!, variants: [{ ...demand[0]!.variants[0]!, buyers: 2 }] }]
    expect(supplierNextActions(health, 3, below).some((a) => a.kind === "answer_restock_demand")).toBe(false)
  })
})

// ---------- the real tracking and read, on an in-memory database ----------
type Row = { id: string; action: string; entityId: string | null; payload: unknown; createdAt: Date }
const db = vi.hoisted(() => ({
  audit: new Map<string, Row>(),
  products: [] as Array<Record<string, unknown>>,
  listings: [] as Array<{ id: string; productId: string; hidden?: boolean }>,
  orders: [] as Array<Record<string, unknown>>,
  clock: new Date("2026-11-20T10:00:00Z"),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/marketplace-buyer-product-filter", () => ({ buyerListedAffiliateProductWhere: { __visible: true } }))
vi.mock("@/lib/prisma", () => {
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
  const stage = (p: unknown) => (p as { stage?: string; state?: string } | null) ?? {}
  return {
    prisma: {
      auditLog: {
        findMany: async ({ where }: { where: Record<string, any> }) =>
          [...db.audit.values()]
            .filter((r) => !where.action || r.action === where.action)
            .filter((r) => !where.entityId?.in || where.entityId.in.includes(r.entityId))
            .filter((r) => !where.id?.in || where.id.in.includes(r.id))
            .filter((r) => !where.createdAt?.gte || r.createdAt >= where.createdAt.gte)
            .filter((r) => !where.OR || ["waiting", "back"].includes(String(stage(r.payload).stage)))
            .filter((r) => !where.payload || stage(r.payload).state === where.payload.equals)
            .map((r) => ({ ...clone({ id: r.id, payload: r.payload, entityId: r.entityId }), createdAt: r.createdAt })),
        createMany: async ({ data }: { data: Array<{ id: string; action: string; entityId: string; payload: unknown }> }) => {
          let count = 0
          for (const d of data) if (!db.audit.has(d.id)) (db.audit.set(d.id, { ...d, payload: clone(d.payload), createdAt: db.clock }), count++)
          return { count }
        },
        update: async ({ where, data }: { where: { id: string }; data: { payload: unknown } }) => {
          db.audit.get(where.id)!.payload = clone(data.payload)
          return {}
        },
      },
      affiliateProduct: {
        findMany: async ({ where }: { where: Record<string, any> }) =>
          db.listings
            .filter((l) => (where.id?.in ? where.id.in.includes(l.id) : true) && (where.productId?.in ? where.productId.in.includes(l.productId) : true))
            .filter((l) => !where.__visible || !l.hidden),
      },
      product: {
        findMany: async ({ where }: { where: Record<string, any> }) =>
          db.products.filter((p) => (where.id?.in ? where.id.in.includes(p.id) : true) && (where.supplierId ? p.supplierId === where.supplierId : true)).map(clone).map((p) => ({ ...p, updatedAt: new Date(p.updatedAt as string) })),
      },
      order: {
        findMany: async ({ where }: { where: Record<string, any> }) =>
          db.orders.filter((o) => where.productId.in.includes(o.productId) && (o.paidAt as Date) >= where.paidAt.gte),
      },
    },
  }
})

import { loadDemandEpisodes, trackRestockDemandEpisodes } from "@/lib/restock-watch/restock-funnel.server"

const product = (stockM: number, over: Record<string, unknown> = {}) => ({
  id: "p1",
  supplierId: "s1",
  name: "T-shirt",
  updatedAt: "2026-11-01T00:00:00Z",
  active: true,
  isDraft: false,
  tags: [],
  stock: stockM + 3,
  hasVariants: true,
  variants: { variantRows: [{ name: "Noir / M", stock: stockM, attrs: {} }, { name: "Noir / L", stock: 3, attrs: {} }] },
  listingKind: "PHYSICAL",
  commissionRate: 10,
  offerMode: null,
  customColumns: null,
  productVariants: [],
  ...over,
})
const watch = (userId: string, listingId: string, state = "active", requestedAt = "2026-11-19T10:00:00Z") => {
  const id = `restock-watch:${userId}:${listingId}:x`
  db.audit.set(id, {
    id,
    action: "buyer.restock_watch",
    entityId: listingId,
    createdAt: new Date(requestedAt),
    payload: { userId, listingId, productId: "forged", variantKey: "noir|m||", variantLabel: "Noir / M", locale: "fr", state, episode: 1, requestedAt, updatedAt: requestedAt },
  })
}
const episodes = () => [...db.audit.values()].filter((r) => r.action === "restock.demand_episode").map((r) => r.payload as DemandEpisode)

beforeEach(() => {
  db.audit = new Map()
  db.products = [product(0)]
  db.listings = [
    { id: "l1", productId: "p1" },
    { id: "l2", productId: "p1" },
  ]
  db.orders = []
  // three distinct buyers, across two shops, one of them asking twice
  watch("a", "l1")
  watch("a", "l2")
  watch("b", "l2")
  watch("c", "l1")
})

describe("tracking + read — the whole chain on an in-memory database", () => {
  it("opens one episode per exact variant across shops, counting each buyer once", async () => {
    expect(await trackRestockDemandEpisodes(t0)).toMatchObject({ opened: 1 })
    expect(episodes()).toEqual([expect.objectContaining({ productId: "p1", variantKey: "noir|m||", buyersAtOpen: 3, stage: "waiting" })])
    await trackRestockDemandEpisodes(at(1))
    expect(episodes()).toHaveLength(1) // no duplicate
  })

  it("return → purchases after it, refunds apart, buyers who waited counted not named; supplier scope", async () => {
    await trackRestockDemandEpisodes(t0)
    db.products = [product(4, { updatedAt: at(2).toISOString() })]
    expect(await trackRestockDemandEpisodes(at(3))).toMatchObject({ returned: 1 })
    db.orders = [
      { id: "o1", productId: "p1", paidAt: at(4), quantity: 1, variantLabel: "Noir · M", status: "paid", paymentSettlementStatus: null, buyerUserId: "a" },
      { id: "o2", productId: "p1", paidAt: at(5), quantity: 1, variantLabel: "Noir · M", status: "refunded", paymentSettlementStatus: "REFUNDED", buyerUserId: "zz" },
      { id: "o3", productId: "p1", paidAt: at(5), quantity: 1, variantLabel: "Noir · L", status: "paid", paymentSettlementStatus: null, buyerUserId: "b" },
    ]
    const r = await loadDemandEpisodes({ supplierId: "s1", now: at(6) })
    expect(r.views[0]).toMatchObject({ stage: "back", daysToReturn: 3, ordersAfterReturn: 2, refundedOrCancelled: 1, byWaitingBuyers: 1, sheetModifiedAt: at(2).toISOString() })
    expect(r.summary).toMatchObject({ episodes: 1, returned: 1, ordersAfterReturn: 2, refundedOrCancelledAfterReturn: 1, returnRatePct: 100 })
    const json = JSON.stringify(r)
    for (const leak of ['"a"', '"b"', '"zz"', "o1", "o2", "o3", "restock-watch:", "forged", "l1", "l2"]) expect(json).not.toContain(leak)
    expect((await loadDemandEpisodes({ supplierId: "someone-else", now: at(6) })).views).toEqual([])
  })

  it("a variant removed or a demand that lapses closes the episode; the indicator says « closed without return »", async () => {
    await trackRestockDemandEpisodes(t0)
    for (const id of [...db.audit.keys()].filter((k) => k.startsWith("restock-watch:c:"))) (db.audit.get(id)!.payload as Record<string, unknown>).state = "cancelled"
    expect(await trackRestockDemandEpisodes(at(1))).toMatchObject({ closed: 1 })
    expect(episodes()[0]).toMatchObject({ stage: "closed", closeReason: "demand_dropped", droppedBy: { expired: 0, cancelled: 1 } })
    expect((await loadDemandEpisodes({ supplierId: null, now: at(2) })).summary).toMatchObject({ closedWithoutReturn: 1, returned: 0, returnRatePct: 0 })
  })

  it("a stock raised on a product still not sellable is not a return", async () => {
    await trackRestockDemandEpisodes(t0)
    db.products = [product(4, { commissionRate: 0 })]
    expect(await trackRestockDemandEpisodes(at(1))).toMatchObject({ returned: 0 })
    expect(episodes()[0]).toMatchObject({ stage: "waiting", backAt: null })
  })
})

describe("translations — 8 locales", () => {
  for (const l of ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]) {
    it(`${l}: recommendation and follow-up texts present with their placeholders`, () => {
      const m = JSON.parse(readFileSync(join(process.cwd(), "messages", `${l}.json`), "utf8"))
      expect(m.nextActions.kind.answer_restock_demand).toContain("{product}")
      expect(m.nextActions.cta.answer_restock_demand.trim()).not.toBe("")
      expect(m.nextActions.reason.restock_demand).toContain("{variant}")
      expect(m.nextActions.reason.restock_demand).toContain("{count")
      expect(m.nextActions.impact.waitingBuyers).toContain("{count")
      const f = m.catalogHealth.restockDemand.followUp
      for (const k of ["title", "counts", "delay", "orders", "notEvaluable", "partial", "resoldOut", "caveat"]) expect(String(f[k] ?? "").trim(), `${l}.${k}`).not.toBe("")
      expect(m.catalogHealth.restockDemand.noneNow.trim()).not.toBe("")
    })
  }
})
