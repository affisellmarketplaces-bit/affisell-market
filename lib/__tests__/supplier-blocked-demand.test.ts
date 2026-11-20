/**
 * Founder brief 2026-11-19 « Transformer la demande bloquée en opportunité fournisseur »: the real
 * `runSupplierBlockedDemandAlerts` / `loadSupplierBlockedDemand` on an in-memory database, plus the pure rules.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  blockedDemandAlertId,
  digestIsObsolete,
  nextEpisode,
  qualifyBlockedDemand,
  qualifyFailedLines,
  readSupplierBlockedDemandMode,
  SUPPLIER_BLOCKED_DEMAND_NOTIF,
  unavailabilityCause,
} from "@/lib/supplier-demand-alerts/blocked-demand"

type Audit = { id: string; action?: string; entityId?: string; payload?: unknown; createdAt: Date }
const db = vi.hoisted(() => ({
  products: [] as Array<Record<string, unknown>>,
  listings: new Map<string, number>(),
  recalls: [] as Array<{ productId: string; status: string }>,
  orders: [] as Array<{ productId: string; paidAt: Date }>,
  audit: new Map<string, Audit>(),
  notifications: [] as Array<{ id: string; userId: string; type: string; message: string; read: boolean }>,
  now: new Date(),
}))

vi.mock("@/lib/i18n-load-messages", () => ({
  loadAppMessages: () => ({
    catalogHealth: { blockedDemand: { bellSingle: "{product} blocked", bellDigest: "{count} blocked", riskSingle: "{product} risk {days}", attentionDigest: "{count} attention", variantSoldOutSingle: "{product} variant {count} {labels} {available}", variantRiskSingle: "{product} variant risk {count} {labels}" } },
  }),
}))
vi.mock("@/lib/prisma", () => {
  const unique = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
  type W = { id?: { in: string[] }; action?: string; payload?: { path: string[]; equals: unknown }; createdAt?: { gte: Date } }
  const match = (a: Audit, w: W) =>
    (!w.id || w.id.in.includes(a.id)) &&
    (!w.action || a.action === w.action) &&
    (!w.createdAt || a.createdAt >= w.createdAt.gte) &&
    (!w.payload || (a.payload as Record<string, unknown> | undefined)?.[w.payload.path[0]!] === w.payload.equals)
  return {
    prisma: {
      affiliateProduct: {
        groupBy: async ({ where }: { where: { product?: { supplierId: string } } }) =>
          [...db.listings.entries()]
            .filter(([pid]) => !where.product || db.products.find((p) => p.id === pid)?.supplierId === where.product.supplierId)
            .map(([productId, n]) => ({ productId, _count: { _all: n } })),
      },
      product: { findMany: async ({ where }: { where: { id: { in: string[] } } }) => db.products.filter((p) => where.id.in.includes(p.id as string)) },
      productRecall: { findMany: async () => db.recalls },
      order: {
        findMany: async ({ where }: { where: { productId: { in: string[] }; paidAt: { gte: Date } } }) =>
          db.orders.filter((o) => where.productId.in.includes(o.productId) && o.paidAt >= where.paidAt.gte),
        groupBy: async ({ where }: { where: { productId: { in: string[] } } }) =>
          where.productId.in.map((pid) => ({
            productId: pid,
            _max: { paidAt: db.orders.filter((o) => o.productId === pid).map((o) => o.paidAt).sort((a, b) => +b - +a)[0] ?? null },
          })),
      },
      auditLog: {
        findMany: async ({ where }: { where: W }) => [...db.audit.values()].filter((a) => match(a, where)),
        findUnique: async ({ where }: { where: { id: string } }) => db.audit.get(where.id) ?? null,
        create: async ({ data }: { data: Omit<Audit, "createdAt"> }) => {
          if (db.audit.has(data.id)) throw unique()
          db.audit.set(data.id, { ...data, createdAt: db.now })
          return data
        },
        createMany: async ({ data }: { data: Array<Omit<Audit, "createdAt">> }) => {
          let count = 0
          for (const d of data) if (!db.audit.has(d.id)) (db.audit.set(d.id, { ...d, createdAt: db.now }), count++)
          return { count }
        },
        upsert: async ({ where, create, update }: { where: { id: string }; create: Omit<Audit, "createdAt">; update: { payload: unknown } }) => {
          const cur = db.audit.get(where.id)
          db.audit.set(where.id, cur ? { ...cur, ...update } : { ...create, createdAt: db.now })
        },
        update: async ({ where, data }: { where: { id: string }; data: { payload: unknown } }) => {
          db.audit.set(where.id, { ...db.audit.get(where.id)!, ...data })
        },
      },
      notification: {
        create: async ({ data }: { data: { userId: string; type: string; message: string } }) => {
          const n = { ...data, id: `n${db.notifications.length + 1}`, read: false }
          db.notifications.push(n)
          return n
        },
        updateMany: async ({ where, data }: { where: { id: string; read: boolean }; data: { read: boolean } }) => {
          let count = 0
          for (const n of db.notifications) if (n.id === where.id && n.read === where.read) (Object.assign(n, data), count++)
          return { count }
        },
      },
    },
  }
})

import { loadSupplierBlockedDemand, runSupplierBlockedDemandAlerts } from "@/lib/supplier-demand-alerts/blocked-demand.server"

const DAY = 86_400_000
const day1 = new Date("2026-11-19T06:00:00Z")
const day2 = new Date("2026-11-20T06:00:00Z")
const base = { active: true, isDraft: false, tags: [], hasVariants: false, variants: null, listingKind: "PHYSICAL", commissionRate: 10, offerMode: null, attributes: [] }
const product = (id: string, supplierId: string, stock: number, extra: Record<string, unknown> = {}) => ({ ...base, id, name: id.toUpperCase(), supplierId, stock, ...extra })
const ordersFor = (pid: string, n: number, at: Date) => Array.from({ length: n }, (_, i) => ({ productId: pid, paidAt: new Date(at.getTime() - (i + 1) * DAY) }))

beforeEach(() => {
  vi.stubEnv("SUPPLIER_BLOCKED_DEMAND_ALERTS_MODE", "enforce")
  db.products = [
    product("p1", "s", 0),
    product("p2", "t", 0),
    product("p3", "t", 0, { active: false }),
    product("p4", "u", 0, { active: false }), // recalled by Affisell: the supplier can not fix it
    product("p5", "u", 0), // sold out but nobody bought it: no real demand
    product("p6", "u", 12), // sellable
  ]
  db.listings = new Map([["p1", 2], ["p2", 1], ["p3", 3], ["p4", 1], ["p5", 4], ["p6", 1]])
  db.recalls = [{ productId: "p4", status: "open" }]
  db.orders = [...ordersFor("p1", 3, day1), ...ordersFor("p2", 6, day1), ...ordersFor("p3", 2, day1), ...ordersFor("p4", 9, day1)]
  db.audit = new Map()
  db.notifications = []
  db.now = day1
})
afterEach(() => vi.unstubAllEnvs())

describe("supplier blocked-demand alerts — pure rules", () => {
  it("defaults to observe; only enforce sends", () => {
    expect(readSupplierBlockedDemandMode(null)).toBe("observe")
    expect(readSupplierBlockedDemandMode("enforce")).toBe("enforce")
    expect(readSupplierBlockedDemandMode("off")).toBe("off")
  })

  it("names the cause; an unreadable hold on an inactive product is never read as « no hold »", () => {
    const f = { holds: [] as string[], awaitingReview: false, stockUnconfirmed: false, active: true, isDraft: false, hasExplicitCommission: true, availableUnits: 0 }
    expect(unavailabilityCause(f)).toBe("out_of_stock")
    expect(unavailabilityCause({ ...f, holds: ["product_recalled"], active: false })).toBe("held_by_affisell")
    expect(unavailabilityCause({ ...f, holds: null, active: false })).toBe("hold_unverifiable")
    expect(unavailabilityCause({ ...f, stockUnconfirmed: true })).toBe("stock_unconfirmed")
    expect(unavailabilityCause({ ...f, availableUnits: 4 })).toBeNull()
  })

  it("never counts a listing alone as demand; an estimate only with enough orders, labelled apart", () => {
    const f = { productId: "x", productName: "X", supplierId: "s", cause: "out_of_stock" as const, liveListings: 5, ordersBefore: 0, ordersSince: 0, lastPaidAt: null, failedPaidLines: 0, since: day1 }
    expect(qualifyBlockedDemand(f, day2)).toBeNull()
    expect(qualifyBlockedDemand({ ...f, failedPaidLines: 1 }, day2)?.why).toBe("failed_lines")
    expect(qualifyBlockedDemand({ ...f, ordersBefore: 3 }, day2)?.estimate).toBeNull()
    const withPace = qualifyBlockedDemand({ ...f, ordersBefore: 30 }, new Date(day1.getTime() + 10 * DAY))!
    expect(withPace.estimate).toMatchObject({ orders: 10 })
    expect(withPace.estimate!.low).toBeLessThan(10)
    expect(qualifyBlockedDemand({ ...f, cause: "held_by_affisell", ordersBefore: 30 }, day2)).toBeNull()
  })

  it("episodes: the start never moves while unavailable; a resolved problem that returns is a NEW alert", () => {
    const open = nextEpisode(null, "out_of_stock", day1)
    expect(open.opened).toBe(true)
    expect(nextEpisode(open.state, "out_of_stock", day2).changed).toBe(false)
    expect(nextEpisode(open.state, "paused_by_supplier", day2).state!.since).toBe(open.state!.since)
    const closed = nextEpisode(open.state, null, day2)
    expect(closed.resolved).toBe(true)
    const again = nextEpisode(closed.state, "out_of_stock", new Date(day2.getTime() + 2 * DAY))
    expect(blockedDemandAlertId("p", again.state!.since)).not.toBe(blockedDemandAlertId("p", open.state!.since))
  })

  it("a digest is obsolete only when none of its products is still blocked", () => {
    expect(digestIsObsolete(["a", "b"], new Set(["b"]))).toBe(false)
    expect(digestIsObsolete(["a", "b"], new Set())).toBe(true)
  })
})

describe("supplier blocked-demand alerts — the real run", () => {
  it("enforce: one bell per supplier (single / summary), Affisell holds and demand-less products excluded", async () => {
    const run = await runSupplierBlockedDemandAlerts(day1)
    expect(run).toMatchObject({ qualifying: 3, notified: 2, digests: 1, episodesOpened: 5 })
    expect(db.notifications.map((n) => [n.userId, n.type, n.message]).sort()).toEqual([
      ["s", SUPPLIER_BLOCKED_DEMAND_NOTIF, "P1 blocked"],
      ["t", SUPPLIER_BLOCKED_DEMAND_NOTIF, "2 blocked"],
    ])
    expect(db.notifications.some((n) => n.userId === "u")).toBe(false)
  })

  it("never twice: a second run the same day and the next day sends nothing new", async () => {
    await runSupplierBlockedDemandAlerts(day1)
    expect((await runSupplierBlockedDemandAlerts(day1)).notified).toBe(0)
    db.now = day2
    const next = await runSupplierBlockedDemandAlerts(day2)
    expect(next.notified).toBe(0)
    expect(next.alreadyNotified).toBe(3)
  })

  it("a fixed product closes its episode and its unread bell is cleared, not left as a false alarm", async () => {
    await runSupplierBlockedDemandAlerts(day1)
    db.products = db.products.map((p) => (p.id === "p1" ? { ...p, stock: 8 } : p))
    db.now = day2
    const run = await runSupplierBlockedDemandAlerts(day2)
    expect(run.episodesResolved).toBe(1)
    expect(run.obsoleteDigestsCleared).toBe(1)
    expect(db.notifications.find((n) => n.userId === "s")!.read).toBe(true)
    expect(db.notifications.find((n) => n.userId === "t")!.read).toBe(false)
  })

  it("respects the supplier's preference", async () => {
    db.audit.set("supplier-alert-preference:t", { id: "supplier-alert-preference:t", payload: { blockedDemandInApp: false, locale: "fr" }, createdAt: day1 })
    const run = await runSupplierBlockedDemandAlerts(day1)
    expect(run.skippedPreference).toBe(2)
    expect(db.notifications.map((n) => n.userId)).toEqual(["s"])
  })

  it("observe: nothing sent, the day's measurement says what would have been", async () => {
    vi.stubEnv("SUPPLIER_BLOCKED_DEMAND_ALERTS_MODE", "observe")
    const run = await runSupplierBlockedDemandAlerts(day1)
    expect(db.notifications).toEqual([])
    expect(run.observation).toMatchObject({ qualifying: 3, wouldNotifyNew: 3, wouldNotifySuppliers: 2, unavailable: 5 })
    expect(run.observation!.byCause).toMatchObject({ out_of_stock: 3, paused_by_supplier: 1, held_by_affisell: 1 })
    // Observing never uses up a real alert.
    expect([...db.audit.keys()].some((k) => k.startsWith("supplier-blocked-demand-alert:"))).toBe(false)
  })

  it("a paid line that failed for lack of stock is real demand, even without earlier orders", async () => {
    db.products.push(product("p7", "v", 0))
    db.listings.set("p7", 1)
    db.audit.set("trace", { id: "trace", action: "payment.unallocated_line", payload: { productId: "p7", reason: "insufficient_stock", checkoutSessionId: "cs_7", paymentIntentId: "pi_7" }, createdAt: day1 })
    await runSupplierBlockedDemandAlerts(day1)
    const view = await loadSupplierBlockedDemand("v", day1)
    expect(view.items).toHaveLength(1)
    expect(view.items[0]).toMatchObject({ why: "failed_lines", observed: { failedPaidLines: 1, ordersBefore: 0 } })
  })

  it("the supplier view is its own products only, with counts and no reseller field", async () => {
    await runSupplierBlockedDemandAlerts(day1)
    const view = await loadSupplierBlockedDemand("t", day1)
    expect(view.items.map((i) => i.productId).sort()).toEqual(["p2", "p3"])
    const keys = JSON.stringify(view)
    expect(keys).not.toMatch(/affiliate|reseller|email/i)
  })
})

describe("failed paid lines — what counts as real demand (§4)", () => {
  const at = new Date("2026-11-18T10:00:00Z")
  const t = (o: Partial<Parameters<typeof qualifyFailedLines>[0][number]>) => ({
    checkoutSessionId: "cs_1",
    productId: "p",
    reason: "insufficient_stock",
    paymentIntentId: "pi_1",
    createdAt: at,
    ...o,
  })
  const ctx = { paidOrderKeys: new Set<string>(), startOf: () => new Date("2026-11-01T00:00:00Z") }

  it("counts an unavailability failure of a paid checkout once", () => {
    const r = qualifyFailedLines([t({})], ctx)
    expect(r.byProduct.get("p")).toBe(1)
  })
  it("other failures, missing payment, healed lines, duplicates and older traces are excluded — and counted as such", () => {
    const r = qualifyFailedLines(
      [
        t({ reason: "commission_not_explicit" }),
        t({ reason: "order_closed_before_payment" }),
        t({ paymentIntentId: null }),
        t({ checkoutSessionId: "cs_healed" }),
        t({ checkoutSessionId: "cs_2" }),
        t({ checkoutSessionId: "cs_2:line:1" }),
        t({ checkoutSessionId: "cs_old", createdAt: new Date("2026-10-01T00:00:00Z") }),
      ],
      { ...ctx, paidOrderKeys: new Set(["cs_healed|p"]) }
    )
    expect(r.byProduct.get("p")).toBe(1)
    expect(r.excluded).toEqual({ other_reason: 2, no_payment_or_product: 1, order_paid_same_checkout: 1, same_checkout_twice: 1, outside_episode: 1 })
  })
})

describe("preventive stock-out risk in the same daily bell", () => {
  it("a sellable product about to run out joins the supplier's ONE bell; observing never uses up the alert", async () => {
    db.products.push(product("p8", "w", 3))
    db.listings.set("p8", 2)
    for (let i = 0; i < 20; i++) db.orders.push({ productId: "p8", paidAt: new Date(day1.getTime() - (i + 1) * 86_400_000) })
    const run = await runSupplierBlockedDemandAlerts(day1)
    expect(run.riskQualifying).toBe(1)
    const w = db.notifications.filter((n) => n.userId === "w")
    expect(w).toHaveLength(1)
    expect(w[0]!.message).toContain("P8")
    expect((await runSupplierBlockedDemandAlerts(day1)).notified).toBe(0)
  })
  it("observe counts the risk without sending", async () => {
    vi.stubEnv("SUPPLIER_BLOCKED_DEMAND_ALERTS_MODE", "observe")
    db.products.push(product("p8", "w", 3))
    db.listings.set("p8", 2)
    for (let i = 0; i < 20; i++) db.orders.push({ productId: "p8", paidAt: new Date(day1.getTime() - (i + 1) * 86_400_000) })
    const run = await runSupplierBlockedDemandAlerts(day1)
    expect(db.notifications).toEqual([])
    expect(run.observation).toMatchObject({ riskQualifying: 1, wouldNotifyRiskNew: 1, wouldNotifySuppliersAll: 3 })
    expect([...db.audit.keys()].some((k) => k.startsWith("supplier-stockout-risk-alert:"))).toBe(false)
  })
})

describe("variants in the same daily bell (§1)", () => {
  const tee = () =>
    product("p7", "v", 5, {
      hasVariants: true,
      variants: { variantRows: [{ name: "Noir / M", stock: 0 }, { name: "Noir / L", stock: 5 }] },
    })
  const sales = () =>
    Array.from({ length: 3 }, (_, i) => ({ productId: "p7", paidAt: new Date(day1.getTime() - (i + 1) * DAY), variantLabel: "Noir · M", quantity: 1, affiliateId: "a" }))

  it("a size sold out while the rest sells joins the supplier's ONE bell, quoting it and what is still on sale", async () => {
    db.products = [tee()]
    db.listings = new Map([["p7", 2]])
    db.orders = sales()
    const run = await runSupplierBlockedDemandAlerts(day1)
    expect(run.variantQualifying).toBe(1)
    expect(db.notifications).toHaveLength(1)
    expect(db.notifications[0]!.userId).toBe("v")
    expect(db.notifications[0]!.message).toContain("Noir / M")
    // Same situation the next day: never rung twice.
    db.now = day2
    await runSupplierBlockedDemandAlerts(day2)
    expect(db.notifications).toHaveLength(1)
  })

  it("a product already rung as blocked as a whole is not rung again for its variants", async () => {
    db.products = [{ ...tee(), active: false }]
    db.listings = new Map([["p7", 2]])
    db.orders = sales()
    const run = await runSupplierBlockedDemandAlerts(day1)
    expect(run.variantQualifying).toBe(0)
  })

  it("observe: counted, nothing sent, the real notice is not used up", async () => {
    vi.stubEnv("SUPPLIER_BLOCKED_DEMAND_ALERTS_MODE", "observe")
    db.products = [tee()]
    db.listings = new Map([["p7", 2]])
    db.orders = sales()
    const run = await runSupplierBlockedDemandAlerts(day1)
    expect(db.notifications).toHaveLength(0)
    expect(run.observation?.wouldNotifyVariantNew).toBe(1)
    expect([...db.audit.keys()].some((k) => k.startsWith("supplier-variant-stock-alert:"))).toBe(false)
  })
})

describe("supplier blocked-demand alerts — boundaries", () => {
  it("never writes a product, a stock, a listing or money", () => {
    const src = readFileSync(path.resolve(__dirname, "../supplier-demand-alerts/blocked-demand.server.ts"), "utf8")
    expect(src).not.toMatch(/prisma\.(product|affiliateProduct|order|productVariant)\.(create|update|upsert|delete)/)
    expect(src).not.toMatch(/from "stripe"|@\/lib\/stripe"|\.refunds\.|\.transfers\./)
  })
})
