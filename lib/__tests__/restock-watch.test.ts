/**
 * Founder brief 2026-11-19 §3 — « Prévenez-moi au retour de cette taille ». The pure rules, then the REAL
 * create / cancel / notify on an in-memory database: exact variant only, explicit request only, one notification per
 * request, never when the stock vanished again before sending, nothing sent outside `enforce`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  decideRestockWatch,
  locateWatchedVariant,
  readRestockWatchMode,
  restockWatchId,
  restockWatchSentId,
  variantWatchKey,
  type RestockWatch,
} from "@/lib/restock-watch/restock-watch"
import { variantRowDimensions } from "@/lib/variant-selection"

type Listing = { id: string; isListed: boolean; productId: string; customTitle: string | null; product: Record<string, unknown> }
type Audit = { id: string; action: string; payload: unknown; createdAt: number }

const db = vi.hoisted(() => ({
  listings: new Map<string, Listing>(),
  hidden: new Set<string>(),
  audit: new Map<string, Audit>(),
  pushUsers: new Set<string>(),
  sent: [] as Array<{ userId: string; title: string; body: string; url: string; tag: string }>,
  /** Called on each `findUnique` of a listing — lets a test change the stock between the scan and the send. */
  onRead: null as null | ((id: string, n: number) => void),
  reads: 0,
  clock: 0,
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/i18n-load-messages", () => ({
  loadAppMessages: () => ({ restockWatch: { pushTitle: "Back: {product}", pushBody: "{variant} is back" } }),
}))
vi.mock("@/lib/marketplace-buyer-product-filter", () => ({ buyerListedAffiliateProductWhere: {} }))
vi.mock("@/lib/web-push-send", () => ({
  sendRestockPushToUser: async (p: { userId: string; title: string; body: string; url: string; tag: string }) => {
    db.sent.push(p)
    return 1
  },
}))
vi.mock("@/lib/prisma", () => {
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
  const state = (p: unknown) => (p as { state?: string } | null)?.state
  return {
    prisma: {
      affiliateProduct: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          db.reads++
          db.onRead?.(where.id, db.reads)
          const l = db.listings.get(where.id)
          return l ? clone(l) : null
        },
        findFirst: async ({ where }: { where: { id: string } }) =>
          db.listings.has(where.id) && !db.hidden.has(where.id) ? { id: where.id } : null,
        findMany: async ({ where, select }: { where: { id: { in: string[] } }; select: Record<string, unknown> }) =>
          where.id.in
            .filter((id) => db.listings.has(id) && ("product" in select || !db.hidden.has(id)))
            .map((id) => clone(db.listings.get(id)!)),
      },
      auditLog: {
        findUnique: async ({ where }: { where: { id: string } }) => (db.audit.has(where.id) ? clone(db.audit.get(where.id)!) : null),
        count: async ({ where }: { where: { id: { startsWith: string } } }) =>
          [...db.audit.values()].filter((a) => a.id.startsWith(where.id.startsWith) && state(a.payload) === "active").length,
        findMany: async ({ where }: { where: { action: string; id?: { startsWith: string }; payload?: unknown } }) =>
          [...db.audit.values()]
            .filter((a) => a.action === where.action && (!where.id || a.id.startsWith(where.id.startsWith)) && (!where.payload || state(a.payload) === "active"))
            .sort((a, b) => a.createdAt - b.createdAt)
            .map(clone),
        createMany: async ({ data }: { data: Array<{ id: string; action: string; payload: unknown }> }) => {
          let count = 0
          for (const d of data)
            if (!db.audit.has(d.id)) {
              db.audit.set(d.id, { id: d.id, action: d.action, payload: clone(d.payload), createdAt: db.clock++ })
              count++
            }
          return { count }
        },
        update: async ({ where, data }: { where: { id: string }; data: { payload: unknown } }) => {
          const a = db.audit.get(where.id)
          if (!a) throw new Error("not found")
          a.payload = clone(data.payload)
          return a
        },
      },
      pushSubscription: { count: async ({ where }: { where: { userId: string } }) => (db.pushUsers.has(where.userId) ? 1 : 0) },
    },
  }
})

import { cancelRestockWatch, createRestockWatch, listRestockWatches, runRestockWatchNotify } from "@/lib/restock-watch/restock-watch.server"

const rows = (stocks: { noirM: number; noirL: number; blancM?: number }) => ({
  variantRows: [
    { name: "Noir / M", stock: stocks.noirM, attrs: {} },
    { name: "Noir / L", stock: stocks.noirL, attrs: {} },
    { name: "Blanc / M", stock: stocks.blancM ?? 4, attrs: {} },
  ],
})
const product = (variants: unknown) => ({
  id: "p1",
  name: "T-shirt",
  active: true,
  isDraft: false,
  tags: [],
  stock: 0,
  hasVariants: true,
  variants,
  listingKind: "PHYSICAL",
  commissionRate: 10,
  offerMode: null,
  customColumns: null,
  productVariants: [],
})
const setStock = (s: { noirM: number; noirL: number; blancM?: number }) => {
  db.listings.get("l1")!.product = product(rows(s))
}
const noirM = { color: "Noir", size: "M", storage: null }
const t0 = new Date("2026-11-19T10:00:00Z")
const later = new Date("2026-11-20T10:00:00Z")

beforeEach(() => {
  vi.stubEnv("RESTOCK_WATCH_MODE", "enforce")
  db.listings = new Map([["l1", { id: "l1", isListed: true, productId: "p1", customTitle: null, product: product(rows({ noirM: 0, noirL: 3 })) }]])
  db.hidden = new Set()
  db.audit = new Map()
  db.pushUsers = new Set(["u1", "u2"])
  db.sent = []
  db.onRead = null
  db.reads = 0
})
afterEach(() => vi.unstubAllEnvs())

describe("pure rules", () => {
  it("mode is off unless observe / enforce is written", () => {
    expect(readRestockWatchMode(undefined)).toBe("off")
    expect(readRestockWatchMode("yes")).toBe("off")
    expect(readRestockWatchMode(" Observe ")).toBe("observe")
    expect(readRestockWatchMode("enforce")).toBe("enforce")
  })

  it("one id per buyer × listing × exact variant; the send id carries the episode", () => {
    const [m, l] = variantRowDimensions(rows({ noirM: 0, noirL: 0 }), null)
    expect(variantWatchKey(m!)).not.toBe(variantWatchKey(l!))
    const id = restockWatchId("u1", "l1", variantWatchKey(m!))
    expect(id).toBe(restockWatchId("u1", "l1", variantWatchKey(m!)))
    expect(id).not.toBe(restockWatchId("u2", "l1", variantWatchKey(m!)))
    expect(restockWatchSentId(id, 1)).not.toBe(restockWatchSentId(id, 2))
  })

  it("locates the exact variant, says when it is gone or ambiguous", () => {
    const key = variantWatchKey(variantRowDimensions(rows({ noirM: 2, noirL: 0 }), null)[0]!)
    expect(locateWatchedVariant(rows({ noirM: 2, noirL: 0 }), null, key)).toEqual({ status: "found", index: 0, stock: 2 })
    expect(locateWatchedVariant({ variantRows: [{ name: "Noir / L", stock: 1 }] }, null, key)).toEqual({ status: "gone" })
    expect(locateWatchedVariant({ variantRows: [{ name: "Noir / M", stock: 1 }, { name: "noir / m", stock: 1 }] }, null, key)).toEqual({ status: "ambiguous" })
  })

  it("notifies only when really back; uncertain = keep waiting; expired / removed = close", () => {
    const w: RestockWatch = {
      userId: "u",
      listingId: "l",
      productId: "p",
      variantKey: "k",
      variantLabel: "",
      locale: "fr",
      state: "active",
      episode: 1,
      requestedAt: t0.toISOString(),
      updatedAt: t0.toISOString(),
    }
    const ok = { exists: true, listed: true, sellable: true }
    const found = (stock: number) => ({ status: "found" as const, index: 0, stock })
    expect(decideRestockWatch({ watch: w, now: later, listing: ok, variant: found(1) })).toEqual({ action: "notify" })
    expect(decideRestockWatch({ watch: w, now: later, listing: ok, variant: found(0) })).toEqual({ action: "keep", reason: "still_sold_out" })
    expect(decideRestockWatch({ watch: w, now: later, listing: { ...ok, sellable: false }, variant: found(5) }).action).toBe("keep")
    expect(decideRestockWatch({ watch: w, now: later, listing: { ...ok, listed: false }, variant: found(5) }).action).toBe("keep")
    expect(decideRestockWatch({ watch: w, now: later, listing: ok, variant: { status: "ambiguous" } }).action).toBe("keep")
    expect(decideRestockWatch({ watch: w, now: later, listing: ok, variant: { status: "gone" } })).toEqual({ action: "close", reason: "variant_removed" })
    expect(decideRestockWatch({ watch: w, now: later, listing: null, variant: null })).toEqual({ action: "close", reason: "listing_removed" })
    expect(decideRestockWatch({ watch: w, now: new Date("2027-03-01T00:00:00Z"), listing: ok, variant: found(5) })).toEqual({ action: "close", reason: "expired" })
    expect(decideRestockWatch({ watch: { ...w, state: "notified" }, now: later, listing: ok, variant: found(5) })).toEqual({ action: "skip" })
  })
})

describe("subscribe / unsubscribe", () => {
  it("records ONE request for the exact sold-out variant, idempotently", async () => {
    const a = await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "en", now: t0 })
    const b = await createRestockWatch({ userId: "u1", listingId: "l1", choice: { color: "noir", size: "m", storage: null }, locale: "en", now: t0 })
    expect(a).toMatchObject({ ok: true, already: false })
    expect(b).toMatchObject({ ok: true, already: true })
    expect(a.ok && b.ok && a.watchId === b.watchId).toBe(true)
    expect(await listRestockWatches("u1")).toEqual([expect.objectContaining({ listingId: "l1", state: "active", variantLabel: "Noir / M" })])
    expect(await listRestockWatches("u2")).toEqual([])
  })

  it("refuses an incomplete, unknown or currently available choice — never a guessed variant", async () => {
    expect(await createRestockWatch({ userId: "u1", listingId: "l1", choice: { color: "Noir", size: null, storage: null }, locale: "fr" })).toEqual({ ok: false, error: "variant_incomplete" })
    expect(await createRestockWatch({ userId: "u1", listingId: "l1", choice: { color: "Rouge", size: "M", storage: null }, locale: "fr" })).toEqual({ ok: false, error: "variant_unknown" })
    expect(await createRestockWatch({ userId: "u1", listingId: "l1", choice: { color: "Noir", size: "L", storage: null }, locale: "fr" })).toEqual({ ok: false, error: "available_now" })
    db.hidden.add("l1")
    expect(await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "fr" })).toEqual({ ok: false, error: "listing_not_found" })
    expect(db.audit.size).toBe(0)
  })

  it("does nothing while the feature is off", async () => {
    vi.stubEnv("RESTOCK_WATCH_MODE", "")
    expect(await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "fr" })).toEqual({ ok: false, error: "mode_off" })
    expect(await runRestockWatchNotify(later)).toMatchObject({ mode: "off", active: 0 })
    expect(db.audit.size).toBe(0)
  })

  it("a buyer cancels only their own request, and a cancelled one is never sent", async () => {
    const r = await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "fr", now: t0 })
    const id = r.ok ? r.watchId : ""
    expect(await cancelRestockWatch("u2", id)).toBe(false)
    expect(await cancelRestockWatch("u1", id)).toBe(true)
    setStock({ noirM: 5, noirL: 3 })
    await runRestockWatchNotify(later)
    expect(db.sent).toEqual([])
  })
})

describe("notification run", () => {
  it("sends ONE push when the exact variant is back, and never again for that request", async () => {
    await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "en", now: t0 })
    await runRestockWatchNotify(later)
    expect(db.sent).toEqual([]) // still sold out
    setStock({ noirM: 2, noirL: 3 })
    const run = await runRestockWatchNotify(later)
    expect(run).toMatchObject({ notified: 1, wouldNotify: 1 })
    expect(db.sent).toEqual([
      { userId: "u1", title: "Back: T-shirt", body: "Noir / M is back", url: "/marketplace/l1", tag: "affisell-restock-l1" },
    ])
    await runRestockWatchNotify(later)
    await runRestockWatchNotify(later)
    expect(db.sent).toHaveLength(1)
  })

  it("another variant coming back does not notify; the watched one does", async () => {
    await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "fr", now: t0 })
    setStock({ noirM: 0, noirL: 9, blancM: 9 })
    await runRestockWatchNotify(later)
    expect(db.sent).toEqual([])
  })

  it("no false notification when the stock is gone again right before sending", async () => {
    await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "fr", now: t0 })
    setStock({ noirM: 1, noirL: 3 })
    db.reads = 0
    db.onRead = () => setStock({ noirM: 0, noirL: 3 }) // sold out between the scan and the send
    const run = await runRestockWatchNotify(later)
    expect(run.raced).toBe(1)
    expect(db.sent).toEqual([])
    expect((await listRestockWatches("u1"))[0]!.state).toBe("active") // still waiting for a real return
  })

  it("observe measures what it would send and sends nothing", async () => {
    await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "fr", now: t0 })
    vi.stubEnv("RESTOCK_WATCH_MODE", "observe")
    setStock({ noirM: 4, noirL: 3 })
    const run = await runRestockWatchNotify(later)
    expect(run).toMatchObject({ mode: "observe", wouldNotify: 1, notified: 0 })
    expect(db.sent).toEqual([])
    expect((await listRestockWatches("u1"))[0]!.state).toBe("active")
    expect([...db.audit.keys()].some((k) => k.startsWith("restock-watch-observation:"))).toBe(true)
  })

  it("a buyer with no push subscription left gets nothing and the request keeps waiting", async () => {
    await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "fr", now: t0 })
    db.pushUsers.delete("u1")
    setStock({ noirM: 4, noirL: 3 })
    expect(await runRestockWatchNotify(later)).toMatchObject({ noChannel: 1, notified: 0 })
    expect(db.sent).toEqual([])
  })

  it("closes useless requests: variant removed, older than 90 days", async () => {
    await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "fr", now: t0 })
    db.listings.get("l1")!.product = product({ variantRows: [{ name: "Noir / L", stock: 3, attrs: {} }] })
    expect((await runRestockWatchNotify(later)).closed).toEqual({ variant_removed: 1 })
    expect((await listRestockWatches("u1"))[0]!.state).toBe("closed")

    db.listings.get("l1")!.product = product(rows({ noirM: 0, noirL: 3 }))
    await createRestockWatch({ userId: "u2", listingId: "l1", choice: noirM, locale: "fr", now: t0 })
    expect((await runRestockWatchNotify(new Date("2027-03-01T00:00:00Z"))).closed).toEqual({ expired: 1 })
  })

  it("asking again after a notification opens a new episode, told once more", async () => {
    await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "fr", now: t0 })
    setStock({ noirM: 2, noirL: 3 })
    await runRestockWatchNotify(later)
    setStock({ noirM: 0, noirL: 3 })
    expect(await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "fr", now: later })).toMatchObject({ ok: true, already: false })
    setStock({ noirM: 1, noirL: 3 })
    await runRestockWatchNotify(later)
    expect(db.sent).toHaveLength(2)
  })

  it("two buyers on the same variant are each told once", async () => {
    await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "fr", now: t0 })
    await createRestockWatch({ userId: "u2", listingId: "l1", choice: noirM, locale: "fr", now: t0 })
    setStock({ noirM: 1, noirL: 3 })
    await runRestockWatchNotify(later)
    expect(db.sent.map((s) => s.userId).sort()).toEqual(["u1", "u2"])
  })

  it("a sent claim already taken (concurrent run) sends nothing twice", async () => {
    const r = await createRestockWatch({ userId: "u1", listingId: "l1", choice: noirM, locale: "fr", now: t0 })
    const id = r.ok ? r.watchId : ""
    db.audit.set(restockWatchSentId(id, 1), { id: restockWatchSentId(id, 1), action: "x", payload: {}, createdAt: 999 })
    setStock({ noirM: 1, noirL: 3 })
    await runRestockWatchNotify(later)
    expect(db.sent).toEqual([])
    expect((await listRestockWatches("u1"))[0]!.state).toBe("notified")
  })
})
