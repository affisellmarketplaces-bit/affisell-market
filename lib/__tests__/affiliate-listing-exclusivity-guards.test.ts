import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  listingFindUnique: vi.fn(),
  listingFindMany: vi.fn(),
  listingUpdate: vi.fn(),
  listingUpdateMany: vi.fn(),
  listingCount: vi.fn(),
  productFindUnique: vi.fn(),
  productFindMany: vi.fn(),
  gate: vi.fn(),
  requireKyc: vi.fn(),
  revalidate: vi.fn(),
  cancelAuctions: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateProduct: {
      findUnique: m.listingFindUnique,
      findMany: m.listingFindMany,
      update: m.listingUpdate,
      updateMany: m.listingUpdateMany,
      count: m.listingCount,
    },
    product: { findUnique: m.productFindUnique, findMany: m.productFindMany },
  },
}))
vi.mock("@/lib/merchant-legal/require-merchant-verified", () => ({
  merchantVerificationGate: m.gate,
  requireMerchantVerifiedForPublish: m.requireKyc,
}))
vi.mock("@/lib/revalidate-affiliate-shopfront", () => ({ revalidateAffiliateShopfront: m.revalidate }))
vi.mock("@/lib/revalidate-listing-card-image", () => ({ revalidateListingCardImage: vi.fn() }))
vi.mock("@/lib/auction-listing-lifecycle", () => ({ cancelAuctionsForListings: m.cancelAuctions }))
vi.mock("@/lib/affiliate-listing-remove", () => ({ removeAffiliateListingsFromStorefront: vi.fn() }))

import { PATCH as bulkPatch } from "@/app/api/affiliate/products/bulk/route"
import { PATCH as listingPatch } from "@/app/api/affiliate/listings/[id]/route"
import {
  publishAffiliateListingIfAllowed,
  syncAffiliateStorefrontListingsLive,
} from "@/lib/affiliate-publish-listing.server"

const DAY = 24 * 60 * 60 * 1000
const future = new Date(Date.now() + 10 * DAY)
const past = new Date(Date.now() - DAY)

function req(body: unknown) {
  return new Request("http://localhost/api", { method: "PATCH", body: JSON.stringify(body) })
}

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
  m.auth.mockResolvedValue({ user: { id: "me", role: "AFFILIATE" } })
  m.gate.mockResolvedValue({ allowed: true, status: "APPROVED" })
  m.requireKyc.mockResolvedValue(null)
  m.revalidate.mockResolvedValue("slug")
  m.cancelAuctions.mockResolvedValue(0)
  m.listingUpdateMany.mockResolvedValue({ count: 1 })
  vi.spyOn(console, "log").mockImplementation(() => undefined)
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

describe("publishAffiliateListingIfAllowed", () => {
  const draft = { id: "l1", affiliateId: "me", isListed: false, productId: "p1" }

  it("does not publish a draft whose product another reseller holds in exclusivity", async () => {
    m.listingFindUnique.mockResolvedValue(draft)
    m.productFindUnique.mockResolvedValue({ exclusiveAffiliateId: "other", exclusiveUntil: future })
    await expect(publishAffiliateListingIfAllowed({ affiliateId: "me", listingId: "l1" })).resolves.toEqual({
      ok: false,
      reason: "exclusive",
      until: future,
    })
    expect(m.listingUpdate).not.toHaveBeenCalled()
  })

  it("publishes normally for open products, the holder, and expired exclusivities", async () => {
    m.listingFindUnique.mockResolvedValue(draft)
    for (const exclusive of [
      { exclusiveAffiliateId: null, exclusiveUntil: null },
      { exclusiveAffiliateId: "me", exclusiveUntil: future },
      { exclusiveAffiliateId: "other", exclusiveUntil: past },
    ]) {
      m.productFindUnique.mockResolvedValue(exclusive)
      m.listingUpdate.mockClear()
      await expect(publishAffiliateListingIfAllowed({ affiliateId: "me", listingId: "l1" })).resolves.toMatchObject({
        ok: true,
        alreadyLive: false,
      })
      expect(m.listingUpdate).toHaveBeenCalledTimes(1)
    }
  })
})

describe("syncAffiliateStorefrontListingsLive (runs on every dashboard load)", () => {
  it("never auto-relists a product held in exclusivity by another reseller", async () => {
    m.listingCount.mockResolvedValue(2)
    m.listingUpdateMany.mockResolvedValue({ count: 2 })
    await syncAffiliateStorefrontListingsLive("me")

    const productFilter = { OR: expect.arrayContaining([{ exclusiveAffiliateId: null }, { exclusiveAffiliateId: "me" }]) }
    for (const call of [m.listingCount.mock.calls[0]![0], m.listingUpdateMany.mock.calls[0]![0]]) {
      expect(call.where).toMatchObject({ affiliateId: "me", isListed: false, product: productFilter })
      expect(call.where.product.OR).toHaveLength(4) // open, no end date, expired, or the reseller's own
    }
  })
})

describe("bulk PATCH isListed", () => {
  it("lists the allowed listings and reports the ones blocked by another reseller's exclusivity", async () => {
    m.listingFindMany.mockResolvedValue([
      { id: "l1", productId: "pA" },
      { id: "l2", productId: "pB" },
    ])
    m.productFindMany.mockResolvedValue([{ id: "pB", exclusiveAffiliateId: "other", exclusiveUntil: future }])

    const res = await bulkPatch(req({ ids: ["l1", "l2"], isListed: true }))
    expect(await res.json()).toEqual({ ok: true, exclusiveBlocked: 1 })
    const listCall = m.listingUpdateMany.mock.calls.find((c) => c[0].data.isListed === true)!
    expect(listCall[0].where.id).toEqual({ in: ["l1"] })
  })

  it("is unchanged when nothing is blocked, and unlisting is never filtered", async () => {
    m.listingFindMany.mockResolvedValue([{ id: "l1", productId: "pA" }])
    m.productFindMany.mockResolvedValue([])
    const ok = await bulkPatch(req({ ids: ["l1"], isListed: true }))
    expect(await ok.json()).toEqual({ ok: true })
    expect(m.listingUpdateMany.mock.calls[0]![0].where.id).toEqual({ in: ["l1"] })

    m.listingFindMany.mockClear()
    m.productFindMany.mockClear()
    await bulkPatch(req({ ids: ["l1"], isListed: false }))
    expect(m.listingFindMany).not.toHaveBeenCalled()
    expect(m.productFindMany).not.toHaveBeenCalled()
  })
})

describe("listing PATCH (re-list)", () => {
  const row = (exclusive: { exclusiveAffiliateId: string | null; exclusiveUntil: Date | null }) => ({
    id: "l1",
    affiliateId: "me",
    isListed: false,
    auctionEligible: false,
    sellingPriceCents: 5000,
    product: { basePriceCents: 1000, ...exclusive },
  })
  const ctx = { params: Promise.resolve({ id: "l1" }) }

  it("refuses to put a product live when another reseller holds its exclusivity", async () => {
    m.listingFindUnique.mockResolvedValue(row({ exclusiveAffiliateId: "other", exclusiveUntil: future }))
    const res = await listingPatch(req({ isListed: true }), ctx)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: "product_exclusive", until: future.toISOString() })
    expect(m.listingUpdate).not.toHaveBeenCalled()
  })

  it("lets the holder and unrestricted products go live, and never blocks unlisting", async () => {
    m.listingUpdate.mockResolvedValue({ id: "l1" })
    m.listingFindUnique.mockResolvedValue(row({ exclusiveAffiliateId: "me", exclusiveUntil: future }))
    expect((await listingPatch(req({ isListed: true }), ctx)).status).toBe(200)

    m.listingFindUnique.mockResolvedValue({ ...row({ exclusiveAffiliateId: "other", exclusiveUntil: future }), isListed: true })
    expect((await listingPatch(req({ isListed: false }), ctx)).status).toBe(200)
  })
})
