import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  grant: vi.fn(),
  revoke: vi.fn(),
  decline: vi.fn(),
  loadSupplier: vi.fn(),
  loadAffiliate: vi.fn(),
  request: vi.fn(),
  release: vi.fn(),
  cancel: vi.fn(),
  reqFindFirst: vi.fn(),
  storeFindUnique: vi.fn(),
}))

vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("@/lib/prisma", () => ({
  prisma: { productExclusivityRequest: { findFirst: m.reqFindFirst }, store: { findUnique: m.storeFindUnique } },
}))
vi.mock("@/lib/product-exclusivity.server", () => ({
  grantProductExclusivity: m.grant,
  revokeProductExclusivity: m.revoke,
  declineExclusivityRequest: m.decline,
  loadSupplierProductExclusivity: m.loadSupplier,
  loadAffiliateProductExclusivityState: m.loadAffiliate,
  requestProductExclusivity: m.request,
  releaseProductExclusivity: m.release,
  cancelExclusivityRequest: m.cancel,
}))

import {
  DELETE as affiliateDelete,
  GET as affiliateGet,
  POST as affiliatePost,
} from "@/app/api/affiliate/products/[id]/exclusivity/route"
import {
  DELETE as supplierDelete,
  GET as supplierGet,
  POST as supplierPost,
} from "@/app/api/supplier/products/[id]/exclusivity/route"

const until = new Date("2026-12-01T00:00:00Z")
const sctx = { params: Promise.resolve({ id: "p1" }) }
const actx = { params: Promise.resolve({ id: "p1" }) }
const post = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body) })
const plain = () => new Request("http://x")

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
})

describe("supplier exclusivity route", () => {
  beforeEach(() => m.auth.mockResolvedValue({ user: { id: "sup-1", role: "SUPPLIER" } }))

  it("rejects the unauthenticated and non-suppliers on every method", async () => {
    m.auth.mockResolvedValueOnce(null)
    expect((await supplierGet(plain(), sctx)).status).toBe(401)
    m.auth.mockResolvedValue({ user: { id: "aff-1", role: "AFFILIATE" } })
    expect((await supplierGet(plain(), sctx)).status).toBe(403)
    expect((await supplierPost(post({ action: "grant", affiliateId: "a" }), sctx)).status).toBe(403)
    expect((await supplierDelete(plain(), sctx)).status).toBe(403)
    expect(m.grant).not.toHaveBeenCalled()
    expect(m.revoke).not.toHaveBeenCalled()
  })

  it("GET returns the holder, requests, live listings and the rules the UI states", async () => {
    m.loadSupplier.mockResolvedValue({
      holder: { affiliateId: "aff-1", storeName: "Léa", grantedAt: until, until, canRevoke: true },
      requests: [{ id: "r1", affiliateId: "aff-2", storeName: "Zed", message: "hi", createdAt: until }],
      liveListings: 2,
    })
    const body = await (await supplierGet(plain(), sctx)).json()
    expect(m.loadSupplier).toHaveBeenCalledWith("sup-1", "p1")
    expect(body.holder).toMatchObject({ affiliateId: "aff-1", until: until.toISOString(), canRevoke: true })
    expect(body.requests[0]).toMatchObject({ id: "r1", createdAt: until.toISOString() })
    expect(body.rules).toEqual({ minDays: 7, maxDays: 365, defaultDays: 90, revokeWindowHours: 48 })

    m.loadSupplier.mockResolvedValue(null)
    expect((await supplierGet(plain(), sctx)).status).toBe(404)
  })

  it("grant by reseller id passes the term and eviction choice through", async () => {
    m.grant.mockResolvedValue({ ok: true, until, extended: false, evicted: 2 })
    const res = await supplierPost(post({ action: "grant", affiliateId: "aff-1", days: 30, evictOthers: true }), sctx)
    expect(await res.json()).toEqual({ ok: true, until: until.toISOString(), extended: false, evicted: 2 })
    expect(m.grant).toHaveBeenCalledWith({
      supplierId: "sup-1",
      productId: "p1",
      affiliateId: "aff-1",
      days: 30,
      evictOthers: true,
    })
  })

  it("grant from a request resolves the reseller from the supplier's own pending request only", async () => {
    m.reqFindFirst.mockResolvedValueOnce(null)
    expect((await supplierPost(post({ action: "grant", requestId: "r9" }), sctx)).status).toBe(404)
    expect(m.reqFindFirst.mock.calls[0]![0].where).toEqual({
      id: "r9",
      productId: "p1",
      supplierId: "sup-1",
      status: "PENDING",
    })
    expect(m.grant).not.toHaveBeenCalled()

    m.reqFindFirst.mockResolvedValueOnce({ affiliateId: "aff-7" })
    m.grant.mockResolvedValue({ ok: true, until, extended: false, evicted: 0 })
    await supplierPost(post({ action: "grant", requestId: "r1" }), sctx)
    expect(m.grant.mock.calls[0]![0]).toMatchObject({ affiliateId: "aff-7", evictOthers: false })
  })

  it("grant by store slug resolves the reseller's store (case-insensitive) or says it does not exist", async () => {
    m.storeFindUnique.mockResolvedValueOnce(null)
    const missing = await supplierPost(post({ action: "grant", storeSlug: "Ghost-Shop" }), sctx)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: "store_not_found" })
    expect(m.storeFindUnique.mock.calls[0]![0].where).toEqual({ slug: "ghost-shop" })
    expect(m.grant).not.toHaveBeenCalled()

    m.storeFindUnique.mockResolvedValueOnce({ userId: "aff-9" })
    m.grant.mockResolvedValue({ ok: true, until, extended: false, evicted: 0 })
    await supplierPost(post({ action: "grant", storeSlug: "maison-lea", days: 60 }), sctx)
    expect(m.grant.mock.calls[0]![0]).toMatchObject({ affiliateId: "aff-9", days: 60 })
  })

  it("maps grant failures to precise statuses, with the data the UI needs", async () => {
    const cases: [unknown, number, Record<string, unknown>][] = [
      [{ ok: false, error: "product_not_found" }, 404, { error: "product_not_found" }],
      [{ ok: false, error: "affiliate_not_eligible" }, 400, { error: "affiliate_not_eligible" }],
      [{ ok: false, error: "other_listings", otherListings: 3 }, 409, { error: "other_listings", otherListings: 3 }],
      [{ ok: false, error: "held_by_other", until }, 409, { error: "held_by_other", until: until.toISOString() }],
      [{ ok: false, error: "not_a_marketplace_product" }, 409, { error: "not_a_marketplace_product" }],
    ]
    for (const [result, status, expected] of cases) {
      m.grant.mockResolvedValueOnce(result)
      const res = await supplierPost(post({ action: "grant", affiliateId: "aff-1" }), sctx)
      expect(res.status).toBe(status)
      expect(await res.json()).toMatchObject(expected)
    }
  })

  it("validates the payload", async () => {
    expect((await supplierPost(post({ action: "nope" }), sctx)).status).toBe(400)
    expect((await supplierPost(post({ action: "grant" }), sctx)).status).toBe(400)
    expect((await supplierPost(post({ action: "decline" }), sctx)).status).toBe(400)
  })

  it("decline answers the supplier's own request", async () => {
    m.decline.mockResolvedValueOnce({ ok: true })
    expect((await supplierPost(post({ action: "decline", requestId: "r1" }), sctx)).status).toBe(200)
    expect(m.decline).toHaveBeenCalledWith({ supplierId: "sup-1", requestId: "r1" })
    m.decline.mockResolvedValueOnce({ ok: false })
    expect((await supplierPost(post({ action: "decline", requestId: "r2" }), sctx)).status).toBe(404)
  })

  it("DELETE revokes inside the cooling-off window and explains why it cannot after", async () => {
    m.revoke.mockResolvedValueOnce({ ok: true })
    expect((await supplierDelete(plain(), sctx)).status).toBe(200)
    m.revoke.mockResolvedValueOnce({ ok: false, error: "revoke_window_closed" })
    expect((await supplierDelete(plain(), sctx)).status).toBe(403)
    m.revoke.mockResolvedValueOnce({ ok: false, error: "not_exclusive" })
    expect((await supplierDelete(plain(), sctx)).status).toBe(409)
    m.revoke.mockResolvedValueOnce({ ok: false, error: "product_not_found" })
    expect((await supplierDelete(plain(), sctx)).status).toBe(404)
  })
})

describe("affiliate exclusivity route", () => {
  beforeEach(() => m.auth.mockResolvedValue({ user: { id: "aff-1", role: "AFFILIATE" } }))

  it("only resellers", async () => {
    m.auth.mockResolvedValueOnce(null)
    expect((await affiliateGet(plain(), actx)).status).toBe(401)
    m.auth.mockResolvedValue({ user: { id: "sup-1", role: "SUPPLIER" } })
    expect((await affiliateGet(plain(), actx)).status).toBe(403)
    expect((await affiliatePost(post({}), actx)).status).toBe(403)
    expect((await affiliateDelete(plain(), actx)).status).toBe(403)
  })

  it("GET returns the reseller's view", async () => {
    m.loadAffiliate.mockResolvedValueOnce({ state: "mine", until })
    expect(await (await affiliateGet(plain(), actx)).json()).toEqual({ state: "mine", until: until.toISOString() })
    m.loadAffiliate.mockResolvedValueOnce({ state: "none", until: null })
    expect(await (await affiliateGet(plain(), actx)).json()).toEqual({ state: "none", until: null })
    m.loadAffiliate.mockResolvedValueOnce(null)
    expect((await affiliateGet(plain(), actx)).status).toBe(404)
  })

  it("POST requests exclusivity and maps failures", async () => {
    m.request.mockResolvedValueOnce({ ok: true, requestId: "r1" })
    expect((await affiliatePost(post({ message: "pls" }), actx)).status).toBe(201)
    expect(m.request).toHaveBeenCalledWith({ affiliateId: "aff-1", productId: "p1", message: "pls" })

    for (const [error, status] of [
      ["product_not_found", 404],
      ["own_product", 400],
      ["no_store", 400],
      ["already_exclusive", 409],
      ["already_requested", 409],
    ] as const) {
      m.request.mockResolvedValueOnce({ ok: false, error })
      expect((await affiliatePost(post({}), actx)).status).toBe(status)
    }
  })

  it("DELETE releases a held exclusivity, otherwise withdraws an open request", async () => {
    m.release.mockResolvedValueOnce({ ok: true })
    expect(await (await affiliateDelete(plain(), actx)).json()).toEqual({ ok: true, released: true })

    m.release.mockResolvedValueOnce({ ok: false, error: "not_exclusive" })
    m.cancel.mockResolvedValueOnce(true)
    expect(await (await affiliateDelete(plain(), actx)).json()).toEqual({ ok: true, cancelled: true })

    m.release.mockResolvedValueOnce({ ok: false, error: "not_exclusive" })
    m.cancel.mockResolvedValueOnce(false)
    expect((await affiliateDelete(plain(), actx)).status).toBe(409)

    m.release.mockResolvedValueOnce({ ok: false, error: "not_holder" })
    expect((await affiliateDelete(plain(), actx)).status).toBe(403)
    expect(m.cancel).toHaveBeenCalledTimes(2) // never withdraws a request when someone else holds the product
  })
})
