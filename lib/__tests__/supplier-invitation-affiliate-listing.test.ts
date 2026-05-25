import { beforeEach, describe, expect, it, vi } from "vitest"

const { findUnique, findFirst, aggregate, create } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  aggregate: vi.fn(),
  create: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateProduct: { findUnique, aggregate, create },
    product: { findFirst },
  },
}))

import { prisma } from "@/lib/prisma"
import { ensureInviterDraftListingForInvite } from "@/lib/supplier-invitation-affiliate-listing"

describe("ensureInviterDraftListingForInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findUnique.mockResolvedValue(null)
    vi.mocked(prisma.product.findFirst).mockResolvedValue({ basePriceCents: 2500 } as never)
    aggregate.mockResolvedValue({ _max: { position: 2 } })
    create.mockResolvedValue({ id: "listing_1" })
  })

  it("creates draft listing at base price", async () => {
    const result = await ensureInviterDraftListingForInvite({
      affiliateId: "aff_1",
      productId: "prod_1",
    })
    expect(result.created).toBe(true)
    expect(result.listingId).toBe("listing_1")
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          affiliateId: "aff_1",
          productId: "prod_1",
          sellingPriceCents: 2500,
          isListed: false,
          position: 3,
        }),
      })
    )
  })

  it("skips when listing already exists", async () => {
    findUnique.mockResolvedValue({ id: "existing" })
    const result = await ensureInviterDraftListingForInvite({
      affiliateId: "aff_1",
      productId: "prod_1",
    })
    expect(result.created).toBe(false)
    expect(create).not.toHaveBeenCalled()
  })
})
