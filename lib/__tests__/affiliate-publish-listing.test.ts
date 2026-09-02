import { beforeEach, describe, expect, it, vi } from "vitest"

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}))

const { merchantVerificationGate } = vi.hoisted(() => ({
  merchantVerificationGate: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateProduct: { findUnique, update },
  },
}))

vi.mock("@/lib/merchant-legal/require-merchant-verified", () => ({
  merchantVerificationGate,
}))

import { publishAffiliateListingIfAllowed } from "@/lib/affiliate-publish-listing.server"

describe("publishAffiliateListingIfAllowed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findUnique.mockResolvedValue({
      id: "listing_1",
      affiliateId: "aff_1",
      isListed: false,
    })
    merchantVerificationGate.mockResolvedValue({ allowed: true, status: "APPROVED" })
    update.mockResolvedValue({ id: "listing_1", isListed: true })
  })

  it("publishes draft when KYC allows", async () => {
    const result = await publishAffiliateListingIfAllowed({
      affiliateId: "aff_1",
      listingId: "listing_1",
    })
    expect(result).toEqual({ ok: true, listingId: "listing_1", alreadyLive: false })
    expect(update).toHaveBeenCalledWith({
      where: { id: "listing_1" },
      data: { isListed: true },
    })
  })

  it("blocks publish when KYC pending", async () => {
    merchantVerificationGate.mockResolvedValue({
      allowed: false,
      status: "PENDING",
      reason: "pending",
    })
    const result = await publishAffiliateListingIfAllowed({
      affiliateId: "aff_1",
      listingId: "listing_1",
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe("kyc")
    expect(update).not.toHaveBeenCalled()
  })
})
