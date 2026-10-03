import { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => {
  const fns = {
    txProductFindFirst: vi.fn(),
    txProductUpdate: vi.fn(),
    txUserFindFirst: vi.fn(),
    txListingFindMany: vi.fn(),
    txListingUpdateMany: vi.fn(),
    txReqUpdateMany: vi.fn(),
    txReqFindMany: vi.fn(),
    productFindUnique: vi.fn(),
    productFindMany: vi.fn(),
    productFindFirst: vi.fn(),
    productUpdateMany: vi.fn(),
    reqCreate: vi.fn(),
    reqUpdateMany: vi.fn(),
    reqFindFirst: vi.fn(),
    reqFindMany: vi.fn(),
    storeFindUnique: vi.fn(),
    storeFindMany: vi.fn(),
    listingCount: vi.fn(),
    notificationCreateMany: vi.fn(),
    cancelAuctions: vi.fn(),
    revalidate: vi.fn(),
  }
  return fns
})

vi.mock("server-only", () => ({}))
vi.mock("@/lib/auction-listing-lifecycle", () => ({ cancelAuctionsForListings: m.cancelAuctions }))
vi.mock("@/lib/revalidate-affiliate-shopfront", () => ({ revalidateAffiliateShopfront: m.revalidate }))
vi.mock("@/lib/prisma", () => {
  const tx = {
    product: { findFirst: m.txProductFindFirst, update: m.txProductUpdate },
    user: { findFirst: m.txUserFindFirst },
    affiliateProduct: { findMany: m.txListingFindMany, updateMany: m.txListingUpdateMany },
    productExclusivityRequest: { updateMany: m.txReqUpdateMany, findMany: m.txReqFindMany },
  }
  return {
    prisma: {
      $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
      product: {
        findUnique: m.productFindUnique,
        findMany: m.productFindMany,
        findFirst: m.productFindFirst,
        updateMany: m.productUpdateMany,
      },
      productExclusivityRequest: {
        create: m.reqCreate,
        updateMany: m.reqUpdateMany,
        findFirst: m.reqFindFirst,
        findMany: m.reqFindMany,
      },
      store: { findUnique: m.storeFindUnique, findMany: m.storeFindMany },
      affiliateProduct: { count: m.listingCount },
      notification: { createMany: m.notificationCreateMany },
    },
  }
})

import {
  checkAffiliateMayListProduct,
  findExclusiveProductsBlockedForAffiliate,
} from "@/lib/product-exclusivity-guard.server"
import { exclusivityBlockBody, exclusivityConflictBody } from "@/lib/product-exclusivity-shared"
import {
  cancelExclusivityRequest,
  declineExclusivityRequest,
  grantProductExclusivity,
  loadAffiliateProductExclusivityState,
  loadSupplierProductExclusivity,
  releaseProductExclusivity,
  requestProductExclusivity,
  revokeProductExclusivity,
} from "@/lib/product-exclusivity.server"

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-10-03T12:00:00Z")
const future = new Date(NOW.getTime() + 20 * DAY)
const past = new Date(NOW.getTime() - DAY)

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
  m.cancelAuctions.mockResolvedValue(0)
  m.revalidate.mockResolvedValue("slug")
  m.notificationCreateMany.mockResolvedValue({ count: 0 })
  m.txReqFindMany.mockResolvedValue([])
  m.txListingFindMany.mockResolvedValue([])
  vi.spyOn(console, "log").mockImplementation(() => undefined)
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

describe("checkAffiliateMayListProduct (guard)", () => {
  it("allows open products, the holder, and expired grants", async () => {
    m.productFindUnique.mockResolvedValueOnce({ exclusiveAffiliateId: null, exclusiveUntil: null })
    await expect(checkAffiliateMayListProduct("p1", "me", NOW)).resolves.toEqual({ ok: true })
    m.productFindUnique.mockResolvedValueOnce({ exclusiveAffiliateId: "me", exclusiveUntil: future })
    await expect(checkAffiliateMayListProduct("p1", "me", NOW)).resolves.toEqual({ ok: true })
    m.productFindUnique.mockResolvedValueOnce({ exclusiveAffiliateId: "other", exclusiveUntil: past })
    await expect(checkAffiliateMayListProduct("p1", "me", NOW)).resolves.toEqual({ ok: true })
  })

  it("blocks everyone but the holder while the exclusivity is active, and says until when", async () => {
    m.productFindUnique.mockResolvedValue({ exclusiveAffiliateId: "other", exclusiveUntil: future })
    const res = await checkAffiliateMayListProduct("p1", "me", NOW)
    expect(res).toEqual({ ok: false, until: future })
    expect(exclusivityConflictBody(future)).toMatchObject({ error: "product_exclusive", until: future.toISOString() })
    expect(exclusivityConflictBody(future).message).toContain("2026-10-23")
    // the no-query variant used by routes that already loaded the product
    expect(exclusivityBlockBody({ exclusiveAffiliateId: "other", exclusiveUntil: future }, "me", NOW)).toEqual(
      exclusivityConflictBody(future)
    )
    expect(exclusivityBlockBody({ exclusiveAffiliateId: "me", exclusiveUntil: future }, "me", NOW)).toBeNull()
    expect(exclusivityBlockBody({ exclusiveAffiliateId: "other", exclusiveUntil: past }, "me", NOW)).toBeNull()
    expect(exclusivityBlockBody({}, "me", NOW)).toBeNull()
  })

  it("never blocks on a missing product or a read failure", async () => {
    m.productFindUnique.mockResolvedValueOnce(null)
    await expect(checkAffiliateMayListProduct("p1", "me", NOW)).resolves.toEqual({ ok: true })
    m.productFindUnique.mockRejectedValueOnce(new Error("db down"))
    await expect(checkAffiliateMayListProduct("p1", "me", NOW)).resolves.toEqual({ ok: true })
  })

  it("batch: returns only products held by somebody else", async () => {
    m.productFindMany.mockResolvedValue([
      { id: "a", exclusiveAffiliateId: "other", exclusiveUntil: future },
      { id: "b", exclusiveAffiliateId: "me", exclusiveUntil: future },
    ])
    await expect(findExclusiveProductsBlockedForAffiliate(["a", "b", "a", ""], "me", NOW)).resolves.toEqual([
      { productId: "a", until: future },
    ])
    expect(m.productFindMany.mock.calls[0]![0].where.id).toEqual({ in: ["a", "b"] })
    await expect(findExclusiveProductsBlockedForAffiliate([], "me", NOW)).resolves.toEqual([])
  })
})

describe("grantProductExclusivity", () => {
  const product = {
    id: "p1",
    name: "Casque",
    images: ["https://cdn.example.com/p.jpg"],
    active: true,
    isDraft: false,
    exclusiveAffiliateId: null,
    exclusiveGrantedAt: null,
    exclusiveUntil: null,
  }
  const affiliate = { id: "aff-1", store: { name: "Maison Léa" } }
  const base = { supplierId: "sup-1", productId: "p1", affiliateId: "aff-1", now: NOW }

  it("only the owning supplier can grant, on a live marketplace product, to a reseller with a store", async () => {
    m.txProductFindFirst.mockResolvedValueOnce(null)
    await expect(grantProductExclusivity(base)).resolves.toEqual({ ok: false, error: "product_not_found" })
    expect(m.txProductFindFirst.mock.calls[0]![0].where).toEqual({ id: "p1", supplierId: "sup-1" })

    m.txProductFindFirst.mockResolvedValueOnce({ ...product, isDraft: true })
    await expect(grantProductExclusivity(base)).resolves.toEqual({ ok: false, error: "not_a_marketplace_product" })

    m.txProductFindFirst.mockResolvedValue(product)
    m.txUserFindFirst.mockResolvedValueOnce(null)
    await expect(grantProductExclusivity(base)).resolves.toEqual({ ok: false, error: "affiliate_not_eligible" })
    m.txUserFindFirst.mockResolvedValueOnce({ id: "aff-1", store: null })
    await expect(grantProductExclusivity(base)).resolves.toEqual({ ok: false, error: "affiliate_not_eligible" })
    expect(m.txProductUpdate).not.toHaveBeenCalled()
  })

  it("refuses while another reseller holds an active exclusivity", async () => {
    m.txProductFindFirst.mockResolvedValue({ ...product, exclusiveAffiliateId: "someone", exclusiveUntil: future })
    m.txUserFindFirst.mockResolvedValue(affiliate)
    await expect(grantProductExclusivity(base)).resolves.toEqual({ ok: false, error: "held_by_other", until: future })
    expect(m.txProductUpdate).not.toHaveBeenCalled()
  })

  it("refuses (and changes nothing) when other resellers already list it, unless asked to remove them", async () => {
    m.txProductFindFirst.mockResolvedValue(product)
    m.txUserFindFirst.mockResolvedValue(affiliate)
    m.txListingFindMany.mockResolvedValue([
      { id: "l1", affiliateId: "x" },
      { id: "l2", affiliateId: "y" },
    ])
    await expect(grantProductExclusivity(base)).resolves.toEqual({ ok: false, error: "other_listings", otherListings: 2 })
    expect(m.txProductUpdate).not.toHaveBeenCalled()
    expect(m.txListingUpdateMany).not.toHaveBeenCalled()
  })

  it("grants for the default 90 days, accepts the holder's request and closes the others'", async () => {
    m.txProductFindFirst.mockResolvedValue(product)
    m.txUserFindFirst.mockResolvedValue(affiliate)
    m.txReqFindMany.mockResolvedValue([{ id: "r2", affiliateId: "loser" }])

    const res = await grantProductExclusivity(base)
    const until = new Date(NOW.getTime() + 90 * DAY)
    expect(res).toEqual({ ok: true, until, extended: false, evicted: 0 })
    expect(m.txProductUpdate.mock.calls[0]![0]).toEqual({
      where: { id: "p1" },
      data: { exclusiveAffiliateId: "aff-1", exclusiveGrantedAt: NOW, exclusiveUntil: until },
    })
    expect(m.txReqUpdateMany.mock.calls[0]![0]).toEqual({
      where: { productId: "p1", affiliateId: "aff-1", status: "PENDING" },
      data: { status: "ACCEPTED", respondedAt: NOW },
    })
    expect(m.txReqUpdateMany.mock.calls[1]![0]).toEqual({
      where: { id: { in: ["r2"] } },
      data: { status: "DECLINED", respondedAt: NOW },
    })
    const notified = m.notificationCreateMany.mock.calls[0]![0].data
    expect(notified.map((n: { userId: string; type: string }) => [n.userId, n.type])).toEqual([
      ["aff-1", "EXCLUSIVITY_GRANTED"],
      ["loser", "EXCLUSIVITY_DECLINED"],
    ])
    expect(m.txListingUpdateMany).not.toHaveBeenCalled()
  })

  it("clamps the term to the allowed range", async () => {
    m.txProductFindFirst.mockResolvedValue(product)
    m.txUserFindFirst.mockResolvedValue(affiliate)
    const tooShort = await grantProductExclusivity({ ...base, days: 1 })
    const tooLong = await grantProductExclusivity({ ...base, days: 9999 })
    expect(tooShort.ok && tooShort.until).toEqual(new Date(NOW.getTime() + 7 * DAY))
    expect(tooLong.ok && tooLong.until).toEqual(new Date(NOW.getTime() + 365 * DAY))
  })

  it("with evictOthers: unlists (never deletes) the other listings, tells their owners, cancels auctions", async () => {
    m.txProductFindFirst.mockResolvedValue(product)
    m.txUserFindFirst.mockResolvedValue(affiliate)
    m.txListingFindMany.mockResolvedValue([
      { id: "l1", affiliateId: "x" },
      { id: "l2", affiliateId: "y" },
    ])
    const res = await grantProductExclusivity({ ...base, evictOthers: true, days: 30 })
    expect(res).toMatchObject({ ok: true, evicted: 2 })

    expect(m.txListingFindMany.mock.calls[0]![0].where).toEqual({
      productId: "p1",
      isListed: true,
      affiliateId: { not: "aff-1" },
    })
    expect(m.txListingUpdateMany.mock.calls[0]![0]).toEqual({
      where: { id: { in: ["l1", "l2"] } },
      data: { isListed: false, isFeatured: false, auctionEligible: false },
    })
    const types = m.notificationCreateMany.mock.calls[0]![0].data.map((n: { userId: string; type: string }) => [n.userId, n.type])
    expect(types).toEqual([
      ["aff-1", "EXCLUSIVITY_GRANTED"],
      ["x", "EXCLUSIVITY_LISTING_REMOVED"],
      ["y", "EXCLUSIVITY_LISTING_REMOVED"],
    ])
    expect(m.cancelAuctions).toHaveBeenCalledWith(["l1", "l2"])
    expect(m.revalidate.mock.calls.map((c) => c[0]).sort()).toEqual(["aff-1", "x", "y"])
  })

  it("granting again to the holder extends from the current end and keeps the original grant date (cooling-off is not re-opened)", async () => {
    const grantedAt = new Date(NOW.getTime() - 10 * DAY)
    m.txProductFindFirst.mockResolvedValue({
      ...product,
      exclusiveAffiliateId: "aff-1",
      exclusiveGrantedAt: grantedAt,
      exclusiveUntil: future,
    })
    m.txUserFindFirst.mockResolvedValue(affiliate)
    const res = await grantProductExclusivity({ ...base, days: 30 })
    const until = new Date(future.getTime() + 30 * DAY)
    expect(res).toEqual({ ok: true, until, extended: true, evicted: 0 })
    expect(m.txProductUpdate.mock.calls[0]![0].data).toEqual({
      exclusiveAffiliateId: "aff-1",
      exclusiveGrantedAt: grantedAt,
      exclusiveUntil: until,
    })
  })

  it("a notification failure never undoes a valid grant", async () => {
    m.txProductFindFirst.mockResolvedValue(product)
    m.txUserFindFirst.mockResolvedValue(affiliate)
    m.notificationCreateMany.mockRejectedValue(new Error("db"))
    await expect(grantProductExclusivity(base)).resolves.toMatchObject({ ok: true })
  })
})

describe("ending an exclusivity", () => {
  it("the holder can release at any time; the supplier is told", async () => {
    m.productFindUnique.mockResolvedValue({
      id: "p1",
      name: "Casque",
      supplierId: "sup-1",
      exclusiveAffiliateId: "aff-1",
      exclusiveUntil: future,
    })
    m.productUpdateMany.mockResolvedValue({ count: 1 })
    await expect(releaseProductExclusivity({ affiliateId: "aff-1", productId: "p1", now: NOW })).resolves.toEqual({ ok: true })
    expect(m.productUpdateMany.mock.calls[0]![0]).toEqual({
      where: { id: "p1", exclusiveAffiliateId: "aff-1" },
      data: { exclusiveAffiliateId: null, exclusiveGrantedAt: null, exclusiveUntil: null },
    })
    expect(m.notificationCreateMany.mock.calls[0]![0].data[0]).toMatchObject({ userId: "sup-1", type: "EXCLUSIVITY_ENDED" })
  })

  it("nobody else can release, and an expired or missing exclusivity cannot be released", async () => {
    m.productFindUnique.mockResolvedValue({ id: "p1", name: "x", supplierId: "s", exclusiveAffiliateId: "aff-1", exclusiveUntil: future })
    await expect(releaseProductExclusivity({ affiliateId: "intruder", productId: "p1", now: NOW })).resolves.toEqual({
      ok: false,
      error: "not_holder",
    })
    m.productFindUnique.mockResolvedValue({ id: "p1", name: "x", supplierId: "s", exclusiveAffiliateId: "aff-1", exclusiveUntil: past })
    await expect(releaseProductExclusivity({ affiliateId: "aff-1", productId: "p1", now: NOW })).resolves.toEqual({
      ok: false,
      error: "not_exclusive",
    })
    m.productFindUnique.mockResolvedValue(null)
    await expect(releaseProductExclusivity({ affiliateId: "aff-1", productId: "p1", now: NOW })).resolves.toEqual({
      ok: false,
      error: "product_not_found",
    })
    expect(m.productUpdateMany).not.toHaveBeenCalled()
  })

  it("the supplier can revoke only inside the 48h cooling-off window", async () => {
    const held = { id: "p1", name: "Casque", exclusiveAffiliateId: "aff-1", exclusiveUntil: future }
    m.productUpdateMany.mockResolvedValue({ count: 1 })

    m.productFindFirst.mockResolvedValueOnce({ ...held, exclusiveGrantedAt: new Date(NOW.getTime() - 5 * 3_600_000) })
    await expect(revokeProductExclusivity({ supplierId: "sup-1", productId: "p1", now: NOW })).resolves.toEqual({ ok: true })
    expect(m.notificationCreateMany.mock.calls[0]![0].data[0]).toMatchObject({ userId: "aff-1", type: "EXCLUSIVITY_ENDED" })

    m.productUpdateMany.mockClear()
    m.productFindFirst.mockResolvedValueOnce({ ...held, exclusiveGrantedAt: new Date(NOW.getTime() - 3 * DAY) })
    await expect(revokeProductExclusivity({ supplierId: "sup-1", productId: "p1", now: NOW })).resolves.toEqual({
      ok: false,
      error: "revoke_window_closed",
    })
    expect(m.productUpdateMany).not.toHaveBeenCalled()
    expect(m.productFindFirst.mock.calls[0]![0].where).toEqual({ id: "p1", supplierId: "sup-1" })
  })
})

describe("requests", () => {
  const product = { id: "p1", name: "Casque", images: [], supplierId: "sup-1", exclusiveAffiliateId: null, exclusiveUntil: null }

  it("creates one request, trims the message and notifies the supplier", async () => {
    m.productFindFirst.mockResolvedValue(product)
    m.storeFindUnique.mockResolvedValue({ name: "Maison Léa" })
    m.reqCreate.mockResolvedValue({ id: "r1" })
    const res = await requestProductExclusivity({ affiliateId: "aff-1", productId: "p1", message: `  ${"x".repeat(900)}  `, now: NOW })
    expect(res).toEqual({ ok: true, requestId: "r1" })
    expect(m.reqCreate.mock.calls[0]![0].data.message).toHaveLength(500)
    expect(m.notificationCreateMany.mock.calls[0]![0].data[0]).toMatchObject({
      userId: "sup-1",
      type: "EXCLUSIVITY_REQUEST",
      message: "Maison Léa demande l'exclusivité sur « Casque ».",
    })
  })

  it("rejects an own product, an already exclusive one, a reseller with no store", async () => {
    m.productFindFirst.mockResolvedValue({ ...product, supplierId: "aff-1" })
    await expect(requestProductExclusivity({ affiliateId: "aff-1", productId: "p1", now: NOW })).resolves.toEqual({ ok: false, error: "own_product" })
    m.productFindFirst.mockResolvedValue({ ...product, exclusiveAffiliateId: "x", exclusiveUntil: future })
    await expect(requestProductExclusivity({ affiliateId: "aff-1", productId: "p1", now: NOW })).resolves.toEqual({ ok: false, error: "already_exclusive" })
    m.productFindFirst.mockResolvedValue(product)
    m.storeFindUnique.mockResolvedValue(null)
    await expect(requestProductExclusivity({ affiliateId: "aff-1", productId: "p1", now: NOW })).resolves.toEqual({ ok: false, error: "no_store" })
    m.productFindFirst.mockResolvedValue(null)
    await expect(requestProductExclusivity({ affiliateId: "aff-1", productId: "p1", now: NOW })).resolves.toEqual({ ok: false, error: "product_not_found" })
    expect(m.reqCreate).not.toHaveBeenCalled()
  })

  it("a second open request is reported, not duplicated (unique partial index)", async () => {
    m.productFindFirst.mockResolvedValue(product)
    m.storeFindUnique.mockResolvedValue({ name: "Maison Léa" })
    m.reqCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" }))
    await expect(requestProductExclusivity({ affiliateId: "aff-1", productId: "p1", now: NOW })).resolves.toEqual({ ok: false, error: "already_requested" })
    expect(m.notificationCreateMany).not.toHaveBeenCalled()
  })

  it("other database errors are not swallowed", async () => {
    m.productFindFirst.mockResolvedValue(product)
    m.storeFindUnique.mockResolvedValue({ name: "x" })
    m.reqCreate.mockRejectedValue(new Error("boom"))
    await expect(requestProductExclusivity({ affiliateId: "aff-1", productId: "p1", now: NOW })).rejects.toThrow("boom")
  })

  it("the reseller can cancel their open request", async () => {
    m.reqUpdateMany.mockResolvedValue({ count: 1 })
    await expect(cancelExclusivityRequest({ affiliateId: "aff-1", productId: "p1" })).resolves.toBe(true)
    expect(m.reqUpdateMany.mock.calls[0]![0].where).toEqual({ productId: "p1", affiliateId: "aff-1", status: "PENDING" })
  })

  it("the supplier declines only their own pending request, once, and the reseller is told", async () => {
    m.reqFindFirst.mockResolvedValue({ id: "r1", affiliateId: "aff-1", productId: "p1" })
    m.reqUpdateMany.mockResolvedValue({ count: 1 })
    m.productFindUnique.mockResolvedValue({ name: "Casque", images: [] })
    await expect(declineExclusivityRequest({ supplierId: "sup-1", requestId: "r1", now: NOW })).resolves.toEqual({ ok: true })
    expect(m.reqFindFirst.mock.calls[0]![0].where).toEqual({ id: "r1", supplierId: "sup-1", status: "PENDING" })
    expect(m.notificationCreateMany.mock.calls[0]![0].data[0]).toMatchObject({ userId: "aff-1", type: "EXCLUSIVITY_DECLINED" })

    m.reqFindFirst.mockResolvedValue(null)
    await expect(declineExclusivityRequest({ supplierId: "sup-1", requestId: "nope" })).resolves.toEqual({ ok: false })
    m.reqFindFirst.mockResolvedValue({ id: "r1", affiliateId: "aff-1", productId: "p1" })
    m.reqUpdateMany.mockResolvedValue({ count: 0 }) // lost the race
    await expect(declineExclusivityRequest({ supplierId: "sup-1", requestId: "r1" })).resolves.toEqual({ ok: false })
  })
})

describe("read models", () => {
  it("supplier view: holder, cooling-off, pending requests with store names, live listings", async () => {
    m.productFindFirst.mockResolvedValue({
      id: "p1",
      exclusiveAffiliateId: "aff-1",
      exclusiveGrantedAt: new Date(NOW.getTime() - 3_600_000),
      exclusiveUntil: future,
    })
    m.reqFindMany.mockResolvedValue([{ id: "r1", affiliateId: "aff-2", message: "hi", createdAt: past }])
    m.listingCount.mockResolvedValue(3)
    m.storeFindMany.mockResolvedValue([
      { userId: "aff-1", name: "Maison Léa" },
      { userId: "aff-2", name: "Boutique Zed" },
    ])
    const view = await loadSupplierProductExclusivity("sup-1", "p1", NOW)
    expect(view).toEqual({
      holder: { affiliateId: "aff-1", storeName: "Maison Léa", grantedAt: expect.any(Date), until: future, canRevoke: true },
      requests: [{ id: "r1", affiliateId: "aff-2", message: "hi", createdAt: past, storeName: "Boutique Zed" }],
      liveListings: 3,
    })
    expect(m.productFindFirst.mock.calls[0]![0].where).toEqual({ id: "p1", supplierId: "sup-1" })
    m.productFindFirst.mockResolvedValue(null)
    await expect(loadSupplierProductExclusivity("sup-1", "nope", NOW)).resolves.toBeNull()
  })

  it("reseller view: mine / other / requested / none", async () => {
    m.productFindUnique.mockResolvedValue({ exclusiveAffiliateId: "me", exclusiveUntil: future })
    m.reqFindFirst.mockResolvedValue(null)
    await expect(loadAffiliateProductExclusivityState("me", "p1", NOW)).resolves.toEqual({ state: "mine", until: future })
    m.productFindUnique.mockResolvedValue({ exclusiveAffiliateId: "x", exclusiveUntil: future })
    await expect(loadAffiliateProductExclusivityState("me", "p1", NOW)).resolves.toEqual({ state: "other", until: null })
    m.productFindUnique.mockResolvedValue({ exclusiveAffiliateId: null, exclusiveUntil: null })
    m.reqFindFirst.mockResolvedValue({ id: "r" })
    await expect(loadAffiliateProductExclusivityState("me", "p1", NOW)).resolves.toEqual({ state: "requested", until: null })
    m.reqFindFirst.mockResolvedValue(null)
    await expect(loadAffiliateProductExclusivityState("me", "p1", NOW)).resolves.toEqual({ state: "none", until: null })
    m.productFindUnique.mockResolvedValue(null)
    await expect(loadAffiliateProductExclusivityState("me", "p1", NOW)).resolves.toBeNull()
  })
})
