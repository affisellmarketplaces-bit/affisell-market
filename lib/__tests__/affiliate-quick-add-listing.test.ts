import { beforeEach, describe, expect, it, vi } from "vitest"

const { findUnique, findFirst, aggregate, create, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  aggregate: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}))

const { merchantVerificationGate } = vi.hoisted(() => ({
  merchantVerificationGate: vi.fn(),
}))

const { publishAffiliateListingIfAllowed } = vi.hoisted(() => ({
  publishAffiliateListingIfAllowed: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateProduct: { findUnique, aggregate, create, update },
    product: { findFirst },
  },
}))

vi.mock("@/lib/merchant-legal/require-merchant-verified", () => ({
  merchantVerificationGate,
}))

vi.mock("@/lib/affiliate-publish-listing.server", () => ({
  publishAffiliateListingIfAllowed,
}))

import { quickAddAffiliateListing } from "@/lib/affiliate-quick-add-listing.server"

describe("quickAddAffiliateListing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findUnique.mockResolvedValue(null)
    findFirst.mockResolvedValue({
      id: "prod_1",
      basePriceCents: 10_000,
      images: ["https://cdn.example.com/a.jpg"],
    })
    aggregate.mockResolvedValue({ _max: { position: 4 } })
    merchantVerificationGate.mockResolvedValue({ allowed: false, reason: "no_profile" })
    publishAffiliateListingIfAllowed.mockResolvedValue({
      ok: true,
      listingId: "existing",
      alreadyLive: false,
    })
    create.mockResolvedValue({
      id: "listing_1",
      productId: "prod_1",
      sellingPriceCents: 13_000,
      isListed: false,
    })
  })

  it("creates draft listing when KYC blocks publish", async () => {
    const result = await quickAddAffiliateListing({
      affiliateId: "aff_1",
      productId: "prod_1",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.created).toBe(true)
    expect(result.published).toBe(false)
    expect(result.publishBlocked).toBe("no_profile")
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          affiliateId: "aff_1",
          productId: "prod_1",
          sellingPriceCents: 13_000,
          isListed: false,
          position: 5,
        }),
      })
    )
  })

  it("creates live listing when KYC allows publish", async () => {
    merchantVerificationGate.mockResolvedValue({ allowed: true, status: "APPROVED" })
    create.mockResolvedValue({
      id: "listing_live",
      productId: "prod_1",
      sellingPriceCents: 13_000,
      isListed: true,
    })

    const result = await quickAddAffiliateListing({
      affiliateId: "aff_1",
      productId: "prod_1",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.published).toBe(true)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isListed: true }),
      })
    )
  })

  it("publishes existing draft on re-add when KYC allows", async () => {
    findUnique.mockResolvedValue({
      id: "existing",
      productId: "prod_1",
      sellingPriceCents: 12_000,
      isListed: false,
    })
    publishAffiliateListingIfAllowed.mockResolvedValue({
      ok: true,
      listingId: "existing",
      alreadyLive: false,
    })

    const result = await quickAddAffiliateListing({
      affiliateId: "aff_1",
      productId: "prod_1",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.created).toBe(false)
    expect(result.published).toBe(true)
    expect(result.listing.isListed).toBe(true)
    expect(publishAffiliateListingIfAllowed).toHaveBeenCalledWith({
      affiliateId: "aff_1",
      listingId: "existing",
    })
    expect(create).not.toHaveBeenCalled()
  })

  it("returns existing draft when KYC still blocks publish", async () => {
    findUnique.mockResolvedValue({
      id: "existing",
      productId: "prod_1",
      sellingPriceCents: 12_000,
      isListed: false,
    })
    publishAffiliateListingIfAllowed.mockResolvedValue({
      ok: false,
      reason: "kyc",
      gate: { allowed: false, status: null, reason: "no_profile" },
    })

    const result = await quickAddAffiliateListing({
      affiliateId: "aff_1",
      productId: "prod_1",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.published).toBe(false)
    expect(result.publishBlocked).toBe("no_profile")
  })

  it("rejects empty productId", async () => {
    const result = await quickAddAffiliateListing({
      affiliateId: "aff_1",
      productId: "  ",
    })
    expect(result).toEqual({ ok: false, status: 400, error: "Missing productId" })
  })
})
