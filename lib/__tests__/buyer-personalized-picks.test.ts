import { beforeEach, describe, expect, it, vi } from "vitest"

const cookiesMock = vi.fn()
const headersMock = vi.fn()

const loadBuyerListingsByCategoryHintsMock = vi.fn()
const loadBuyerListingsByListingIdsMock = vi.fn()
const loadHomeBestSellers7dMock = vi.fn()
const sortBuyerListingCardsByDeliveryCountryBoostMock = vi.fn()

const prismaMock = {
  wishlist: { findMany: vi.fn() },
  order: { findMany: vi.fn() },
  guestWishlist: { findMany: vi.fn() },
  product: { findMany: vi.fn() },
}

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: headersMock,
}))

vi.mock("@/lib/buyer-discovery-data", () => ({
  loadBuyerListingsByCategoryHints: loadBuyerListingsByCategoryHintsMock,
  loadBuyerListingsByListingIds: loadBuyerListingsByListingIdsMock,
}))

vi.mock("@/lib/home-marketplace-data", () => ({
  loadHomeBestSellers7d: loadHomeBestSellers7dMock,
}))

vi.mock("@/lib/buyer-listing-country-boost", () => ({
  sortBuyerListingCardsByDeliveryCountryBoost: sortBuyerListingCardsByDeliveryCountryBoostMock,
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

function makeCard(productId: string) {
  return {
    listingId: `listing-${productId}`,
    productId,
    name: productId,
    imageUrl: null,
    priceCents: 1000,
    compareAtCents: null,
    soldCount: 0,
    marginCents: 0,
    deliveryMin: 2,
    deliveryMax: 5,
    stock: 8,
    freeShipping: false,
    commissionPct: 0,
    averageRating: 4.6,
    reviewCount: 12,
    storeName: "Store",
    storeSlug: "store",
    nicheLabel: "lifestyle" as const,
    categories: ["Fashion"],
    isBestSeller: false,
  }
}

describe("loadBuyerPersonalizedPicks", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({
        value: JSON.stringify(["Fashion"]),
      }),
    })
    headersMock.mockResolvedValue(
      new Headers({
        "x-vercel-ip-country": "FR",
      })
    )

    prismaMock.wishlist.findMany.mockResolvedValue([])
    prismaMock.order.findMany.mockResolvedValue([])
    prismaMock.guestWishlist.findMany.mockResolvedValue([])
    prismaMock.product.findMany.mockResolvedValue([
      { id: "p-fashion", deliveryCountryCodes: ["FR"] },
      { id: "p-filler", deliveryCountryCodes: ["WORLDWIDE"] },
    ])

    loadBuyerListingsByCategoryHintsMock.mockResolvedValue([makeCard("p-fashion")])
    loadHomeBestSellers7dMock.mockResolvedValue([{ listingId: "listing-p-filler", soldCount: 9 }])
    loadBuyerListingsByListingIdsMock.mockResolvedValue([makeCard("p-filler")])
    sortBuyerListingCardsByDeliveryCountryBoostMock.mockImplementation((items) => items)
  })

  it("passes visitor country to personalized and filler loaders", async () => {
    const { loadBuyerPersonalizedPicks } = await import("@/lib/buyer-personalized-picks")

    await loadBuyerPersonalizedPicks({ userId: null, guestId: null })

    expect(loadBuyerListingsByCategoryHintsMock).toHaveBeenCalledWith(
      ["Fashion"],
      [],
      8,
      "FR"
    )
    expect(loadBuyerListingsByListingIdsMock).toHaveBeenCalledWith(
      ["listing-p-filler"],
      ["p-fashion"],
      7,
      "FR"
    )
  })

  it("re-ranks merged picks by delivery country before returning", async () => {
    sortBuyerListingCardsByDeliveryCountryBoostMock.mockImplementation((items) => [items[1], items[0]])

    const { loadBuyerPersonalizedPicks } = await import("@/lib/buyer-personalized-picks")
    const result = await loadBuyerPersonalizedPicks({ userId: null, guestId: null })

    expect(prismaMock.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["p-fashion", "p-filler"] } },
      select: { id: true, deliveryCountryCodes: true },
    })
    expect(sortBuyerListingCardsByDeliveryCountryBoostMock).toHaveBeenCalled()
    expect(result.items.map((item) => item.productId)).toEqual(["p-filler", "p-fashion"])
    expect(result.personalized).toBe(false)
  })
})
