import { beforeEach, describe, expect, it, vi } from "vitest"

const { findUnique, findFirst, aggregate, create, update, count, updateMany, productFindUnique } = vi.hoisted(() => ({
  productFindUnique: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  aggregate: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  updateMany: vi.fn(),
}))

const { merchantVerificationGate } = vi.hoisted(() => ({
  merchantVerificationGate: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateProduct: { findUnique, aggregate, create, update, count, updateMany },
    product: { findFirst, findUnique: productFindUnique },
  },
}))

vi.mock("@/lib/merchant-legal/require-merchant-verified", () => ({
  merchantVerificationGate,
}))

vi.mock("@/lib/revalidate-affiliate-shopfront", () => ({
  revalidateAffiliateShopfront: vi.fn(),
}))

import { quickAddAffiliateListing } from "@/lib/affiliate-quick-add-listing.server"

describe("quickAddAffiliateListing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    merchantVerificationGate.mockResolvedValue({ allowed: true, status: "APPROVED" })
    findUnique.mockResolvedValue(null)
    findFirst.mockResolvedValue({
      id: "prod_1",
      basePriceCents: 10_000,
      images: ["https://cdn.example.com/a.jpg"],
    })
    aggregate.mockResolvedValue({ _max: { position: 4 } })
    create.mockResolvedValue({
      id: "listing_1",
      productId: "prod_1",
      sellingPriceCents: 13_000,
      isListed: false,
    })
    update.mockResolvedValue({ id: "listing_1", isListed: true })
    productFindUnique.mockResolvedValue({ exclusiveAffiliateId: null, exclusiveUntil: null })
  })

  it("creates and auto-publishes listing at +30% suggested price", async () => {
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "listing_1",
        affiliateId: "aff_1",
        isListed: false,
      })
    const result = await quickAddAffiliateListing({
      affiliateId: "aff_1",
      productId: "prod_1",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.created).toBe(true)
    expect(result.listing.sellingPriceCents).toBe(13_000)
    expect(result.listing.isListed).toBe(true)
    expect(result.publishBlocked).toBeNull()
    expect(update).toHaveBeenCalledWith({
      where: { id: "listing_1" },
      data: { isListed: true },
    })
  })

  it("auto-publishes existing draft on idempotent retry", async () => {
    findUnique.mockResolvedValueOnce({
      id: "existing",
      productId: "prod_1",
      sellingPriceCents: 12_000,
      isListed: false,
    })
    findUnique.mockResolvedValueOnce({
      id: "existing",
      affiliateId: "aff_1",
      isListed: false,
    })
    const result = await quickAddAffiliateListing({
      affiliateId: "aff_1",
      productId: "prod_1",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.created).toBe(false)
    expect(result.listing.isListed).toBe(true)
    expect(create).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith({
      where: { id: "existing" },
      data: { isListed: true },
    })
  })

  it("returns publishBlocked when KYC blocks auto-live", async () => {
    merchantVerificationGate.mockResolvedValue({
      allowed: false,
      status: "PENDING",
      reason: "pending",
    })
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "listing_1",
        affiliateId: "aff_1",
        isListed: false,
      })
    const result = await quickAddAffiliateListing({
      affiliateId: "aff_1",
      productId: "prod_1",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.listing.isListed).toBe(false)
    expect(result.publishBlocked).toBe("pending")
    expect(update).not.toHaveBeenCalled()
  })

  it("refuses to create a listing for a product held in exclusivity by another reseller", async () => {
    const until = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    findFirst.mockResolvedValue({
      id: "prod_1",
      basePriceCents: 10_000,
      images: [],
      exclusiveAffiliateId: "someone_else",
      exclusiveUntil: until,
    })
    const result = await quickAddAffiliateListing({ affiliateId: "aff_1", productId: "prod_1" })
    expect(result).toMatchObject({ ok: false, status: 409, error: "product_exclusive", until: until.toISOString() })
    expect(create).not.toHaveBeenCalled()
  })

  it("lets the exclusivity holder add the product", async () => {
    findFirst.mockResolvedValue({
      id: "prod_1",
      basePriceCents: 10_000,
      images: [],
      exclusiveAffiliateId: "aff_1",
      exclusiveUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    })
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "listing_1", affiliateId: "aff_1", isListed: false })
    const result = await quickAddAffiliateListing({ affiliateId: "aff_1", productId: "prod_1" })
    expect(result.ok).toBe(true)
    expect(create).toHaveBeenCalled()
  })

  it("does not publish an existing draft once someone else holds the exclusivity", async () => {
    const until = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    findUnique.mockResolvedValueOnce({ id: "existing", productId: "prod_1", sellingPriceCents: 1, isListed: false })
    productFindUnique.mockResolvedValue({ exclusiveAffiliateId: "someone_else", exclusiveUntil: until })
    const result = await quickAddAffiliateListing({ affiliateId: "aff_1", productId: "prod_1" })
    expect(result).toMatchObject({ ok: false, status: 409, error: "product_exclusive" })
    expect(update).not.toHaveBeenCalled()
  })

  it("rejects empty productId", async () => {
    const result = await quickAddAffiliateListing({
      affiliateId: "aff_1",
      productId: "  ",
    })
    expect(result).toEqual({ ok: false, status: 400, error: "Missing productId" })
  })
})
