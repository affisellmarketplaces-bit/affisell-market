/**
 * Founder brief 2026-11-20 — reseller-side demand intelligence and sales recovery: « N acheteurs de votre boutique
 * attendent Noir / M », alternatives that really offer that variant (replacement engine, wanted-variant mode), the
 * reseller's explicit choice (never an automatic replacement), the recovery chain, access rights, no personal data, i18n.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildReplacementProposal, type OriginalListing, type ReplacementCandidate } from "@/lib/reseller-replacement/match"
import { resellerNextActions } from "@/lib/next-best-action/next-best-action"
import { summarizeShopRecovery, type ChosenMarker, type ShopDemandItem } from "@/lib/restock-watch/shop-demand"
import type { RestockWatch } from "@/lib/restock-watch/restock-watch"

const now = new Date("2026-11-20T10:00:00Z")

// ── In-memory database ──────────────────────────────────────────────────────────────────────────────────────────────
type Listing = { id: string; affiliateId: string; productId: string; customTitle: string | null; isListed: boolean; product: Record<string, unknown> }
type Audit = { id: string; action: string; entityId: string; payload: unknown; createdAt: Date }
type OrderRow = { id: string; affiliateId: string | null; productId: string; paidAt: Date | null; status: string; paymentSettlementStatus: string | null; buyerUserId: string | null }
const db = vi.hoisted(() => ({
  listings: [] as Array<Listing>,
  audit: [] as Array<Audit>,
  orders: [] as Array<OrderRow>,
}))
type InWhere = { in: string[] }
vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateProduct: {
      findMany: async ({ where }: { where: { affiliateId: string } }) => db.listings.filter((l) => l.affiliateId === where.affiliateId),
    },
    auditLog: {
      findMany: async ({ where }: { where: { action: string; entityId?: InWhere; createdAt?: { gte: Date } } }) =>
        db.audit.filter(
          (a) =>
            a.action === where.action &&
            (!where.entityId || where.entityId.in.includes(a.entityId)) &&
            (!where.createdAt || a.createdAt >= where.createdAt.gte)
        ),
      createMany: async ({ data }: { data: Array<Omit<Audit, "createdAt">> }) => {
        let count = 0
        for (const d of data) {
          if (db.audit.some((a) => a.id === d.id)) continue
          db.audit.push({ ...d, createdAt: new Date() })
          count++
        }
        return { count }
      },
    },
    order: {
      findMany: async ({ where }: { where: { productId: InWhere; affiliateId: InWhere; paidAt: { gte: Date } } }) =>
        db.orders.filter((o) => where.productId.in.includes(o.productId) && o.affiliateId && where.affiliateId.in.includes(o.affiliateId) && o.paidAt && o.paidAt >= where.paidAt.gte),
    },
  },
}))
const replacement = vi.hoisted(() => ({
  proposal: null as unknown,
  replaceCalls: 0,
  withdrawCalls: 0,
}))
vi.mock("@/lib/reseller-replacement/replace.server", () => ({
  loadReplacementProposal: async (affiliateId: string, listingId: string) => {
    const l = db.listings.find((x) => x.id === listingId && x.affiliateId === affiliateId)
    return l ? { ok: true, proposal: replacement.proposal, listingIsListed: l.isListed } : { ok: false }
  },
  replaceListing: async () => {
    replacement.replaceCalls++
    return { ok: true }
  },
  withdrawListing: async () => {
    replacement.withdrawCalls++
    return { ok: true }
  },
}))
const quickAdd = vi.hoisted(() => ({ calls: [] as Array<{ affiliateId: string; productId: string }>, created: true }))
vi.mock("@/lib/affiliate-quick-add-listing.server", () => ({
  quickAddAffiliateListing: async (input: { affiliateId: string; productId: string }) => {
    quickAdd.calls.push(input)
    return { ok: true, listing: { id: `new-${input.productId}`, productId: input.productId, sellingPriceCents: 2500, isListed: true }, created: quickAdd.created, publishBlocked: null }
  },
}))
const authState = vi.hoisted(() => ({ session: null as null | { user: { id: string; role: string } } }))
vi.mock("@/auth", () => ({ auth: async () => authState.session }))
vi.mock("@/lib/api-rate-limit", () => ({ rateLimitClientKey: () => "k", rateLimitResponseAsync: async () => null }))
vi.mock("@/lib/request-origin-guard", () => ({ assertSameSiteRequestOrigin: () => null }))

import {
  chooseShopDemandAlternative,
  loadShopDemandAlternatives,
  loadShopRecovery,
  loadShopRestockDemand,
  markShopDemandRecommended,
} from "@/lib/restock-watch/shop-demand.server"
import { GET as shopDemandRoute } from "@/app/api/affiliate/shop-demand/route"
import { GET as altsGet, POST as altsPost } from "@/app/api/affiliate/listings/[id]/shop-demand/route"

const KEY = "noir|m||"
const product = (stockM: number) => ({
  name: "T-shirt coton",
  customColumns: null,
  productVariants: [],
  variants: { variantRows: [{ name: "Noir / M", stock: stockM }, { name: "Noir / L", stock: 4 }, { name: "Blanc / M", stock: 0 }] },
})
const listing = (id: string, affiliateId: string, productId = "p1", stockM = 0): Listing => ({ id, affiliateId, productId, customTitle: null, isListed: true, product: product(stockM) })
let seq = 0
function ask(userId: string, listingId: string, over: Partial<RestockWatch> = {}) {
  const w: RestockWatch = {
    userId,
    listingId,
    productId: "p1",
    variantKey: KEY,
    variantLabel: "Noir / M",
    locale: "fr",
    state: "active",
    episode: 1,
    requestedAt: "2026-11-19T10:00:00Z",
    updatedAt: "2026-11-19T10:00:00Z",
    ...over,
  }
  db.audit.push({ id: `w${++seq}`, action: "buyer.restock_watch", entityId: listingId, payload: w, createdAt: new Date("2026-11-19T10:00:00Z") })
}

beforeEach(() => {
  db.listings = []
  db.audit = []
  db.orders = []
  replacement.proposal = null
  replacement.replaceCalls = 0
  replacement.withdrawCalls = 0
  quickAdd.calls = []
  quickAdd.created = true
  authState.session = null
})

describe("the shop signal — distinct buyers of THIS shop, exact variant, from 3", () => {
  it("shown only from 3 distinct buyers; asking twice counts once", async () => {
    db.listings = [listing("lA", "resA")]
    ask("u1", "lA")
    ask("u1", "lA", { episode: 2 })
    ask("u2", "lA")
    expect(await loadShopRestockDemand("resA", now)).toEqual([])
    ask("u3", "lA")
    expect(await loadShopRestockDemand("resA", now)).toEqual([
      { listingId: "lA", productId: "p1", productName: "T-shirt coton", variantKey: KEY, variantLabel: "Noir / M", buyers: 3 },
    ])
  })

  it("strict isolation: a buyer signed up in two shops counts once in EACH, and no shop sees the other's requests", async () => {
    db.listings = [listing("lA", "resA"), listing("lB", "resB")]
    for (const u of ["u1", "u2", "u3"]) ask(u, "lA")
    ask("u1", "lB")
    ask("u2", "lB")
    // Shop B has 2 own buyers: nothing, even though 3 people wait on the same product across shops.
    expect(await loadShopRestockDemand("resB", now)).toEqual([])
    const a = await loadShopRestockDemand("resA", now)
    expect(a).toHaveLength(1)
    expect(a[0]!.buyers).toBe(3)
    ask("u4", "lB")
    const b = await loadShopRestockDemand("resB", now)
    expect(b[0]).toMatchObject({ listingId: "lB", buyers: 3 })
    // Shop A's figure is unchanged by shop B's new buyer.
    expect((await loadShopRestockDemand("resA", now))[0]!.buyers).toBe(3)
    // A shop never reads another shop's requests: an unknown reseller gets nothing.
    expect(await loadShopRestockDemand("resC", now)).toEqual([])
  })

  it("expired, cancelled, notified or closed requests do not count; a variant back in stock removes the signal", async () => {
    db.listings = [listing("lA", "resA")]
    ask("u1", "lA")
    ask("u2", "lA")
    for (const state of ["cancelled", "notified", "closed", "expired"] as const) ask(`x-${state}`, "lA", { state })
    ask("old", "lA", { requestedAt: "2026-07-01T00:00:00Z" })
    expect(await loadShopRestockDemand("resA", now)).toEqual([])
    ask("u3", "lA")
    expect(await loadShopRestockDemand("resA", now)).toHaveLength(1)
    db.listings = [listing("lA", "resA", "p1", 5)] // resolved: Noir / M has stock again
    expect(await loadShopRestockDemand("resA", now)).toEqual([])
  })

  it("exact variants only: Noir / M, Noir / L and Blanc / M are never added together", async () => {
    db.listings = [listing("lA", "resA")]
    ask("u1", "lA")
    ask("u2", "lA", { variantKey: "noir|l||" })
    ask("u3", "lA", { variantKey: "blanc|m||" })
    ask("u4", "lA", { variantKey: "noir|xl||" }) // a variant that no longer exists
    expect(await loadShopRestockDemand("resA", now)).toEqual([])
  })

  it("carries no personal data: no buyer id, date, contact or order", async () => {
    db.listings = [listing("lA", "resA")]
    for (const u of ["buyer-secret-1", "buyer-secret-2", "buyer-secret-3"]) ask(u, "lA")
    const text = JSON.stringify(await loadShopRestockDemand("resA", now))
    expect(text).not.toContain("buyer-secret")
    expect(text).not.toContain("2026-11-19")
  })
})

// ── Alternatives (replacement engine, wanted-variant mode) ──────────────────────────────────────────────────────────
const original: OriginalListing = {
  listingId: "lA",
  productId: "p1",
  name: "T-shirt coton bio noir",
  categoryId: "cat-tee",
  gtin14: null,
  brand: "Lumio",
  supplierPriceCents: 1000,
  commissionPct: 15,
  sellingPriceHtCents: 1300,
  colors: ["Noir"],
  sizes: ["M", "L"],
  deliveryMaxDays: 7,
  returnWindowDays: 14,
  problem: null,
}
function cand(over: Partial<ReplacementCandidate> = {}): ReplacementCandidate {
  return {
    productId: "p2",
    name: "T-shirt coton bio",
    imageUrl: null,
    categoryId: "cat-tee",
    gtin14: null,
    brand: "Lumio",
    supplierLabel: "Maison Lune",
    supplierPriceCents: 900,
    commissionPct: 15,
    commissionExplicit: true,
    available: 12,
    mayList: true,
    colors: ["Noir"],
    sizes: ["M", "L"],
    deliveryMaxDays: 5,
    returnWindowDays: 30,
    existingListing: null,
    defaultSellingPriceCents: 1170,
    wantedVariant: { status: "found", stock: 8 },
    ...over,
  }
}

describe("alternatives for the waited variant", () => {
  it("only candidates whose SAME variant is really available; at most 3", () => {
    const p = buildReplacementProposal(
      original,
      [
        cand({ productId: "ok1" }),
        cand({ productId: "soldOut", wantedVariant: { status: "found", stock: 0 } }),
        cand({ productId: "gone", wantedVariant: { status: "gone" } }),
        cand({ productId: "ambiguous", wantedVariant: { status: "ambiguous" } }),
        cand({ productId: "noVariant", wantedVariant: undefined }),
        cand({ productId: "ok2" }),
        cand({ productId: "ok3" }),
        cand({ productId: "ok4" }),
      ],
      { affiliateFeeBps: null, wantedVariant: true }
    )
    expect(p.status).toBe("found")
    if (p.status !== "found") return
    expect(p.alternatives).toHaveLength(3)
    expect(p.alternatives.every((a) => a.productId.startsWith("ok"))).toBe(true)
  })

  it("keeps the equivalence criteria: same category alone is never enough", () => {
    const p = buildReplacementProposal(original, [cand({ name: "Mug céramique" })], { affiliateFeeBps: null, wantedVariant: true })
    expect(p).toMatchObject({ status: "none", reason: "no_reliable_match" })
    const none = buildReplacementProposal(original, [cand({ wantedVariant: { status: "found", stock: 0 } })], { affiliateFeeBps: null, wantedVariant: true })
    expect(none).toMatchObject({ status: "none", reason: "no_sellable_candidate" })
  })

  it("not sellable today = not proposed (commission, review, supplier price)", () => {
    for (const bad of [{ commissionExplicit: false }, { mayList: false }, { supplierPriceCents: 0 }] as Array<Partial<ReplacementCandidate>>) {
      expect(buildReplacementProposal(original, [cand(bad)], { affiliateFeeBps: null, wantedVariant: true }).status).toBe("none")
    }
  })

  it("shows the real net after Affisell's fee, the variant's units, a low-stock flag and whether it is already in the shop", () => {
    const p = buildReplacementProposal(
      original,
      [cand({ productId: "low", wantedVariant: { status: "found", stock: 2 }, existingListing: { sellingPriceCents: 1200, isListed: true } })],
      { affiliateFeeBps: 2000, wantedVariant: true }
    )
    if (p.status !== "found") throw new Error("expected found")
    const a = p.alternatives[0]!
    expect(a.wantedVariantUnits).toBe(2)
    expect(a.inShop).toBe(true)
    expect(a.differences.some((d) => d.field === "variant_low_stock")).toBe(true)
    // commission round(900 × 15 %) = 135 + markup 1200 − 900 = 300 → gross 435, fee 20 % = 87 → net 348.
    expect(a.net.netCents).toBe(348)
    expect(a.sellingPriceHtCents).toBe(1200)
  })
})

describe("choosing an alternative — never an automatic replacement", () => {
  const found = () =>
    buildReplacementProposal(original, [cand({ productId: "alt" })], { affiliateFeeBps: null, wantedVariant: true })

  it("adds the chosen product through the quick add only; the requested listing and the requests are untouched", async () => {
    db.listings = [listing("lA", "resA")]
    for (const u of ["u1", "u2", "u3"]) ask(u, "lA")
    replacement.proposal = found()
    const before = JSON.stringify(db.audit.filter((a) => a.action === "buyer.restock_watch"))
    expect(await chooseShopDemandAlternative({ affiliateId: "resA", listingId: "lA", variantKey: KEY, productId: "alt", confirm: false })).toEqual({ ok: false, error: "not_confirmed" })
    expect(quickAdd.calls).toHaveLength(0)
    const r = await chooseShopDemandAlternative({ affiliateId: "resA", listingId: "lA", variantKey: KEY, productId: "alt", confirm: true, now })
    expect(r).toMatchObject({ ok: true, added: true })
    expect(quickAdd.calls).toEqual([{ affiliateId: "resA", productId: "alt" }])
    expect(replacement.replaceCalls + replacement.withdrawCalls).toBe(0)
    expect(db.listings[0]!.isListed).toBe(true)
    expect(JSON.stringify(db.audit.filter((a) => a.action === "buyer.restock_watch"))).toBe(before)
    // Recorded once, even if confirmed twice.
    await chooseShopDemandAlternative({ affiliateId: "resA", listingId: "lA", variantKey: KEY, productId: "alt", confirm: true, now })
    expect(db.audit.filter((a) => a.action === "affiliate.shop_demand_alternative_chosen")).toHaveLength(1)
  })

  it("refuses a product the proposal does not offer, and another reseller's listing", async () => {
    db.listings = [listing("lA", "resA")]
    replacement.proposal = found()
    expect(await chooseShopDemandAlternative({ affiliateId: "resA", listingId: "lA", variantKey: KEY, productId: "elsewhere", confirm: true })).toEqual({
      ok: false,
      error: "alternative_not_offered",
    })
    expect(await chooseShopDemandAlternative({ affiliateId: "resB", listingId: "lA", variantKey: KEY, productId: "alt", confirm: true })).toEqual({ ok: false, error: "not_found" })
    expect(quickAdd.calls).toHaveLength(0)
  })

  it("records the proposal as shown only when the shop really has the demand", async () => {
    db.listings = [listing("lA", "resA")]
    replacement.proposal = found()
    await loadShopDemandAlternatives("resA", "lA", KEY, now)
    expect(db.audit.filter((a) => a.action === "affiliate.shop_demand_shown")).toHaveLength(0)
    for (const u of ["u1", "u2", "u3"]) ask(u, "lA")
    const r = await loadShopDemandAlternatives("resA", "lA", KEY, now)
    expect(r).toMatchObject({ ok: true, demand: { buyers: 3 } })
    await loadShopDemandAlternatives("resA", "lA", KEY, now)
    expect(db.audit.filter((a) => a.action === "affiliate.shop_demand_shown")).toHaveLength(1)
    expect(await loadShopDemandAlternatives("resA", "lA", "", now)).toEqual({ ok: false, error: "variant_key_invalid" })
  })
})

describe("recovery chain — shown ≠ chosen ≠ bought, refunds apart, per shop", () => {
  const demand = (listingId: string, variantKey = KEY): ShopDemandItem => ({ listingId, productId: "p1", productName: "x", variantKey, variantLabel: "Noir / M", buyers: 3 })
  const chosen = (over: Partial<ChosenMarker> = {}): ChosenMarker => ({ affiliateId: "resA", listingId: "lA", variantKey: KEY, productId: "alt", chosenAt: "2026-11-10T00:00:00Z", added: true, ...over })

  it("counts distinct orders of the chosen product in the same shop within 30 days, closed ones apart", () => {
    const s = summarizeShopRecovery({
      demands: [demand("lA"), demand("lA", "noir|l||")],
      recommended: [{ listingId: "lA", variantKey: KEY }, { listingId: "lA", variantKey: KEY }],
      shown: [
        { affiliateId: "resA", listingId: "lA", variantKey: KEY, alternatives: 2, day: "2026-11-09" },
        { affiliateId: "resA", listingId: "lA", variantKey: KEY, alternatives: 3, day: "2026-11-10" },
      ],
      chosen: [chosen(), chosen({ chosenAt: "2026-11-11T00:00:00Z" })],
      orders: [
        { id: "o1", affiliateId: "resA", productId: "alt", paidAt: new Date("2026-11-12"), closed: false, buyerUserId: "u1" },
        { id: "o2", affiliateId: "resA", productId: "alt", paidAt: new Date("2026-11-13"), closed: true, buyerUserId: "stranger" },
        { id: "o3", affiliateId: "resB", productId: "alt", paidAt: new Date("2026-11-13"), closed: false, buyerUserId: "u2" }, // other shop
        { id: "o4", affiliateId: "resA", productId: "alt", paidAt: new Date("2026-11-01"), closed: false, buyerUserId: "u2" }, // before choice
        { id: "o5", affiliateId: "resA", productId: "alt", paidAt: new Date("2026-12-30"), closed: false, buyerUserId: "u2" }, // after 30 days
        { id: "o6", affiliateId: "resA", productId: "other", paidAt: new Date("2026-11-12"), closed: false, buyerUserId: "u2" },
      ],
      waitingBuyers: new Map([[`lA\u0000${KEY}`, new Set(["u1", "u2", "u3"])]]),
    })
    expect(s).toEqual({
      demandsNow: 2,
      recommendationsShown: 1,
      proposalsShown: 1,
      alternativesShown: 3,
      alternativesChosen: 1,
      ordersAfterChoice: 2,
      refundedOrCancelledAfterChoice: 1,
      byWaitingBuyers: 1,
      withoutSolution: 1,
    })
  })

  it("the loader returns counts only, scoped to the shop; the founder view aggregates", async () => {
    db.listings = [listing("lA", "resA"), listing("lB", "resB")]
    for (const u of ["u1", "u2", "u3"]) ask(u, "lA")
    await markShopDemandRecommended("resA", [{ listingId: "lA", variantKey: KEY }])
    replacement.proposal = buildReplacementProposal(original, [cand({ productId: "alt" })], { affiliateFeeBps: null, wantedVariant: true })
    await chooseShopDemandAlternative({ affiliateId: "resA", listingId: "lA", variantKey: KEY, productId: "alt", confirm: true, now: new Date("2026-11-15T00:00:00Z") })
    db.orders = [
      { id: "secret-order", affiliateId: "resA", productId: "alt", paidAt: new Date("2026-11-16"), status: "paid", paymentSettlementStatus: "PAID", buyerUserId: "u1" },
      { id: "o2", affiliateId: "resA", productId: "alt", paidAt: new Date("2026-11-17"), status: "refunded", paymentSettlementStatus: "REFUNDED", buyerUserId: "u9" },
    ]
    const a = await loadShopRecovery({ affiliateId: "resA", now })
    expect(a).toMatchObject({ demandsNow: 1, recommendationsShown: 1, alternativesChosen: 1, ordersAfterChoice: 2, refundedOrCancelledAfterChoice: 1, byWaitingBuyers: 1, withoutSolution: 0 })
    expect(JSON.stringify(a)).not.toMatch(/secret-order|u1|lA|resA/)
    const b = await loadShopRecovery({ affiliateId: "resB", now })
    expect(b).toMatchObject({ recommendationsShown: 0, alternativesChosen: 0, ordersAfterChoice: 0 })
    const all = await loadShopRecovery({ affiliateId: null, now })
    expect(all).toMatchObject({ alternativesChosen: 1, ordersAfterChoice: 2 })
  })
})

describe("next best action for the reseller", () => {
  const d: ShopDemandItem = { listingId: "lA", productId: "p1", productName: "T-shirt", variantKey: KEY, variantLabel: "Noir / M", buyers: 5 }
  it("names the product, the variant and the distinct-buyer count, points at a doable page, one stable key", () => {
    const a = resellerNextActions({ listings: [], drops: [], ready: [], shopDemand: [d, d] }, 3)
    const mine = a.filter((x) => x.kind === "answer_shop_demand")
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ key: `answer_shop_demand:lA:${KEY}`, variantLabel: "Noir / M", impact: { waitingBuyers: 5 }, productName: "T-shirt" })
    expect(mine[0]!.href).toBe(`/dashboard/affiliate/products/lA/replace?variant=${encodeURIComponent(KEY)}`)
  })
  it("gone with the demand, never below 3, never doubled with the listing's own « fix » action", () => {
    expect(resellerNextActions({ listings: [], drops: [], ready: [], shopDemand: [] }, 3).some((x) => x.kind === "answer_shop_demand")).toBe(false)
    expect(resellerNextActions({ listings: [], drops: [], ready: [], shopDemand: [{ ...d, buyers: 2 }] }, 3)).toEqual([])
    type L = Parameters<typeof resellerNextActions>[0]["listings"][number]
    const broken = { listingId: "lA", productId: "p1", name: "T-shirt", problem: "out_of_stock" } as unknown as L
    const r = resellerNextActions({ listings: [broken], drops: [], ready: [], shopDemand: [d] }, 3)
    expect(r.some((x) => x.kind === "answer_shop_demand")).toBe(false)
  })
})

describe("access rights", () => {
  const req = (url: string, init?: RequestInit) => new Request(url, init)
  it("401 without a session, 403 for another role, 404 on another reseller's listing", async () => {
    expect((await shopDemandRoute(req("http://x/api/affiliate/shop-demand"))).status).toBe(401)
    authState.session = { user: { id: "s1", role: "SUPPLIER" } }
    expect((await shopDemandRoute(req("http://x/api/affiliate/shop-demand"))).status).toBe(403)
    expect((await altsGet(req(`http://x/a?variant=${KEY}`), { params: Promise.resolve({ id: "lA" }) })).status).toBe(403)
    authState.session = { user: { id: "resB", role: "AFFILIATE" } }
    db.listings = [listing("lA", "resA")]
    expect((await altsGet(req(`http://x/a?variant=${KEY}`), { params: Promise.resolve({ id: "lA" }) })).status).toBe(404)
    const post = await altsPost(req("http://x/a", { method: "POST", body: JSON.stringify({ variantKey: KEY, productId: "alt", confirm: true }) }), { params: Promise.resolve({ id: "lA" }) })
    expect(post.status).toBe(404)
    expect(quickAdd.calls).toHaveLength(0)
  })
  it("the owner reads its own shop's signal", async () => {
    authState.session = { user: { id: "resA", role: "AFFILIATE" } }
    db.listings = [listing("lA", "resA")]
    for (const u of ["u1", "u2", "u3"]) ask(u, "lA")
    const res = await shopDemandRoute(req("http://x/api/affiliate/shop-demand"))
    const body = (await res.json()) as { items: ShopDemandItem[] }
    expect(body.items).toHaveLength(1)
    expect(JSON.stringify(body)).not.toMatch(/"u[123]"/)
  })
})

describe("8 locales", () => {
  const locales = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"]
  it("every new text exists in every locale", () => {
    const fr = JSON.parse(readFileSync(join(process.cwd(), "messages/fr.json"), "utf8")) as { affiliate: { shopDemand: Record<string, unknown> } }
    const keys = Object.keys(fr.affiliate.shopDemand)
    for (const loc of locales) {
      const m = JSON.parse(readFileSync(join(process.cwd(), `messages/${loc}.json`), "utf8")) as {
        affiliate: { shopDemand: Record<string, unknown> }
        nextActions: { kind: Record<string, string>; cta: Record<string, string>; reason: Record<string, string> }
      }
      expect(Object.keys(m.affiliate.shopDemand)).toEqual(keys)
      expect(m.nextActions.kind.answer_shop_demand).toBeTruthy()
      expect(m.nextActions.cta.answer_shop_demand).toBeTruthy()
      expect(m.nextActions.reason.shop_restock_demand).toContain("{variant}")
    }
  })
})
