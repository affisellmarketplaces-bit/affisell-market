import { describe, expect, it, vi, beforeEach } from "vitest"

const { revalidateTag, findMany } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidateTag,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    affiliateProduct: { findMany },
  },
}))

import { listingCardImageCacheTag } from "@/lib/listing-card-image-shared"
import {
  revalidateListingCardImage,
  revalidateListingCardImagesForProduct,
} from "@/lib/revalidate-listing-card-image"

describe("revalidate listing card image", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("builds stable cache tags", () => {
    expect(listingCardImageCacheTag("abc")).toBe("listing-card-image:abc")
  })

  it("revalidates a single listing tag", () => {
    revalidateListingCardImage("listing-1")
    expect(revalidateTag).toHaveBeenCalledWith("listing-card-image:listing-1", "max")
  })

  it("revalidates all listings for a supplier product", async () => {
    findMany.mockResolvedValue([{ id: "l1" }, { id: "l2" }])
    await revalidateListingCardImagesForProduct("product-1")
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: "product-1" } })
    )
    expect(revalidateTag).toHaveBeenCalledTimes(2)
  })
})
