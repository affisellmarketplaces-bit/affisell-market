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
    create.mockResolvedValue({
      id: "listing_1",
      productId: "prod_1",
      sellingPriceCents: 13_000,
      isListed: false,
    })
  })

  it("creates draft listing at +30% suggested price", async () => {
    const result = await quickAddAffiliateListing({
      affiliateId: "aff_1",
      productId: "prod_1",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.created).toBe(true)
    expect(result.listing.sellingPriceCents).toBe(13_000)
    expect(result.listing.isListed).toBe(false)
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

  it("returns existing listing without create (idempotent)", async () => {
    findUnique.mockResolvedValue({
      id: "existing",
      productId: "prod_1",
      sellingPriceCents: 12_000,
      isListed: false,
    })
    const result = await quickAddAffiliateListing({
      affiliateId: "aff_1",
      productId: "prod_1",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.created).toBe(false)
    expect(result.listing.id).toBe("existing")
    expect(create).not.toHaveBeenCalled()
    expect(findFirst).not.toHaveBeenCalled()
  })

  it("rejects empty productId", async () => {
    const result = await quickAddAffiliateListing({
      affiliateId: "aff_1",
      productId: "  ",
    })
    expect(result).toEqual({ ok: false, status: 400, error: "Missing productId" })
  })
})
