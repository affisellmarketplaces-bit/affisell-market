import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * CHARACTERISATION of `loadHomeBestSellers7d` (lib/home-marketplace-data.ts) — written BEFORE the Lot 1A cache so that the
 * data the Home "Tendances" widget gets cannot silently change. These tests pin what the loader does TODAY; they do not
 * judge it (e.g. ties have no tiebreak, a failing shipping-profile lookup is swallowed): if one of them has to change, it
 * is a functional decision, not a refactor.
 */

vi.mock("server-only", () => ({}))

type SqlCall = { sql: string; values: unknown[] }
const db = vi.hoisted(() => ({
  ranked: [] as { productId: string; c: bigint }[],
  sold: [] as { productId: string; c: bigint }[],
  sqlCalls: [] as { sql: string; values: unknown[] }[],
  queryRaw: vi.fn(),
  listingFindMany: vi.fn(),
  profileFindMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: db.queryRaw,
    affiliateProduct: { findMany: db.listingFindMany },
    supplierShippingProfile: { findMany: db.profileFindMany },
  },
}))

import { loadHomeBestSellers7d, type HomeProductCard } from "@/lib/home-marketplace-data"

const NOW = new Date("2026-10-09T12:00:00.000Z")
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const EXCLUDED_STATUSES = "('cancelled', 'canceled', 'refunded', 'pending', 'failed', 'expired')"

/** `$queryRaw` hands back `bigint` counts (the project compiles for < ES2020, where `9n` literals are not allowed). */
const big = (n: number): bigint => BigInt(n)
const normalizeSql = (s: string) => s.replace(/\s+/g, " ").trim()
const rankedCall = (): SqlCall => db.sqlCalls.find((c) => c.sql.includes('INNER JOIN "Product"'))!
const soldCall = (): SqlCall | undefined => db.sqlCalls.find((c) => !c.sql.includes('INNER JOIN "Product"'))

function listing(productId: string, over: Record<string, unknown> = {}, productOver: Record<string, unknown> = {}) {
  return {
    id: `l-${productId}`,
    sellingPriceCents: 2500,
    productId,
    product: {
      id: productId,
      name: `Product ${productId}`,
      images: [`https://cdn.example/${productId}.jpg`],
      basePriceCents: 1500,
      commissionRate: 20,
      supplierId: "s1",
      deliveryMin: 0,
      deliveryMax: 0,
      deliveryDays: null,
      isBestSeller: false,
      stock: 10,
      freeShipping: false,
      averageRating: 4.5,
      reviewCount: 12,
      ...productOver,
    },
    affiliate: { name: "Alice", store: { name: "Alice Store" } },
    ...over,
  }
}

const offers = [
  { carrierId: "eu_gls", deliveryMin: 2, deliveryMax: 4 },
  { carrierId: "eu_dpd", deliveryMin: 3, deliveryMax: 7 },
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  db.ranked = []
  db.sold = []
  db.sqlCalls = []
  db.queryRaw.mockReset()
  db.queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = normalizeSql(strings.join("?"))
    db.sqlCalls.push({ sql, values })
    return sql.includes('INNER JOIN "Product"') ? db.ranked : db.sold
  })
  db.listingFindMany.mockReset()
  db.listingFindMany.mockResolvedValue([])
  db.profileFindMany.mockReset()
  db.profileFindMany.mockResolvedValue([{ userId: "s1", offers }])
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("loadHomeBestSellers7d — order and structure of the cards", () => {
  it("follows the sales ranking, not the order the listing query happens to return", async () => {
    db.ranked = [
      { productId: "pB", c: big(9) },
      { productId: "pA", c: big(5) },
      { productId: "pC", c: big(2) },
    ]
    db.listingFindMany.mockResolvedValue([listing("pA"), listing("pC"), listing("pB")])

    const cards = await loadHomeBestSellers7d(3)

    expect(cards.map((c) => c.listingId)).toEqual(["l-pB", "l-pA", "l-pC"])
  })

  it("returns exactly the card shape the widget consumes (supplier hint consumed, delivery window from the shop profile)", async () => {
    db.ranked = [{ productId: "pA", c: big(8) }]
    db.sold = [{ productId: "pA", c: big(7) }]
    db.listingFindMany.mockResolvedValue([listing("pA", {}, { isBestSeller: true, commissionRate: 17.6, basePriceCents: 3000 })])

    const [card] = await loadHomeBestSellers7d(3)

    expect(card).toEqual({
      listingId: "l-pA",
      productId: "pA",
      name: "Product pA",
      imageUrl: "https://cdn.example/pA.jpg",
      priceCents: 2500,
      compareAtCents: 3000, // base price above the selling price
      soldCount: 7,
      marginCents: 0,
      deliveryMin: 2,
      deliveryMax: 7,
      stock: 10,
      freeShipping: false,
      commissionPct: 18, // rounded
      averageRating: 4.5,
      reviewCount: 12,
      storeName: "Alice Store",
      isBestSeller: true, // flag set AND ≥ 5 confirmed sales
    })
    expect("supplierId" in card!).toBe(false)
  })

  it("shows the best-seller badge only from 5 confirmed sales, and no compare-at price when base ≤ selling price", async () => {
    db.ranked = [{ productId: "pA", c: big(4) }]
    db.sold = [{ productId: "pA", c: big(4) }]
    db.listingFindMany.mockResolvedValue([listing("pA", {}, { isBestSeller: true, basePriceCents: 1500 })])

    const [card] = await loadHomeBestSellers7d(3)

    expect(card!.isBestSeller).toBe(false)
    expect(card!.compareAtCents).toBeNull()
    expect(card!.marginCents).toBe(1000)
  })

  it("gives a card without usable image a null imageUrl (the widget then shows its icon) instead of dropping it", async () => {
    db.ranked = [{ productId: "pA", c: big(3) }]
    db.listingFindMany.mockResolvedValue([listing("pA", {}, { images: [] })])

    const [card] = await loadHomeBestSellers7d(3)

    expect(card!.imageUrl).toBeNull()
  })

  it("is JSON-safe: what a cache stores and gives back equals what the loader returned (no bigint, no Date, no undefined)", async () => {
    db.ranked = [
      { productId: "pA", c: big(8) },
      { productId: "pB", c: big(6) },
    ]
    db.sold = [{ productId: "pA", c: big(7) }]
    db.listingFindMany.mockResolvedValue([listing("pA"), listing("pB", {}, { supplierId: "s-unknown" })])

    const cards = await loadHomeBestSellers7d(3)
    const roundTrip = JSON.parse(JSON.stringify(cards)) as HomeProductCard[]

    expect(roundTrip).toEqual(cards)
    for (const c of cards) expect(typeof c.soldCount).toBe("number")
  })
})

describe("loadHomeBestSellers7d — empty and absent data", () => {
  it("returns [] for an empty ranking and asks the database for nothing else", async () => {
    db.ranked = []

    await expect(loadHomeBestSellers7d(3)).resolves.toEqual([])

    expect(db.sqlCalls).toHaveLength(1) // the ranking only: no sold-count query
    expect(db.listingFindMany).not.toHaveBeenCalled()
    expect(db.profileFindMany).not.toHaveBeenCalled()
  })

  it("drops a ranked product that has no buyer-visible listing, keeps the order of the rest, and does NOT backfill", async () => {
    db.ranked = [
      { productId: "pA", c: big(9) },
      { productId: "pGone", c: big(8) },
      { productId: "pC", c: big(3) },
    ]
    db.listingFindMany.mockResolvedValue([listing("pC"), listing("pA")])

    const cards = await loadHomeBestSellers7d(3)

    expect(cards.map((c) => c.productId)).toEqual(["pA", "pC"]) // 2 cards for limit 3
    expect(db.sqlCalls).toHaveLength(2) // ranking + sold counts: no extra query to fill the gap
    expect(db.listingFindMany).toHaveBeenCalledTimes(1)
  })

  it("returns [] when every ranked product lost its listing", async () => {
    db.ranked = [{ productId: "pGone", c: big(9) }]
    db.listingFindMany.mockResolvedValue([])

    await expect(loadHomeBestSellers7d(3)).resolves.toEqual([])
    expect(db.profileFindMany).not.toHaveBeenCalled() // nothing left to look a window up for
  })
})

describe("loadHomeBestSellers7d — sales counter", () => {
  it("uses the confirmed sold count when there is one, otherwise the ranking count, always as a number", async () => {
    db.ranked = [
      { productId: "pA", c: big(9) },
      { productId: "pB", c: big(6) },
    ]
    db.sold = [{ productId: "pA", c: big(7) }] // pB has no row in the second query
    db.listingFindMany.mockResolvedValue([listing("pA"), listing("pB")])

    const cards = await loadHomeBestSellers7d(3)

    expect(cards.map((c) => c.soldCount)).toEqual([7, 6])
  })

  it("counts over the SAME 7-day window and status list in both queries", async () => {
    db.ranked = [{ productId: "pA", c: big(9) }]
    db.listingFindMany.mockResolvedValue([listing("pA")])

    await loadHomeBestSellers7d(3)

    const since = NOW.getTime() - SEVEN_DAYS_MS
    const ranking = rankedCall()
    const sold = soldCall()!
    expect((ranking.values[0] as Date).getTime()).toBe(since)
    expect((sold.values[1] as Date).getTime()).toBe(since)
    for (const sql of [ranking.sql, sold.sql]) {
      expect(sql).toContain('"paidAt" >=')
      expect(sql).toContain(`NOT IN ${EXCLUDED_STATUSES}`)
    }
    expect(ranking.sql).toContain("p.active = true")
  })
})

describe("loadHomeBestSellers7d — ties and listing choice", () => {
  it("keeps the database order for equal sales (no tiebreak in the SQL or in the code — pinned, not endorsed)", async () => {
    db.ranked = [
      { productId: "pZ", c: big(4) },
      { productId: "pX", c: big(4) },
      { productId: "pY", c: big(4) },
    ]
    db.listingFindMany.mockResolvedValue([listing("pX"), listing("pY"), listing("pZ")])

    const cards = await loadHomeBestSellers7d(3)

    expect(cards.map((c) => c.productId)).toEqual(["pZ", "pX", "pY"])
    expect(rankedCall().sql).toMatch(/ORDER BY c DESC LIMIT/) // a single sort key: ties are left to the database
  })

  it("asks for listings by ascending id and keeps the FIRST one per product", async () => {
    db.ranked = [{ productId: "pA", c: big(9) }]
    db.listingFindMany.mockResolvedValue([
      listing("pA", { id: "l-first", sellingPriceCents: 1000 }),
      listing("pA", { id: "l-second", sellingPriceCents: 9999 }),
    ])

    const [card] = await loadHomeBestSellers7d(3)

    expect(card!.listingId).toBe("l-first")
    const args = db.listingFindMany.mock.calls[0]![0]
    expect(args.orderBy).toEqual({ id: "asc" })
    expect(args.where.productId).toEqual({ in: ["pA"] })
    expect(args.where.isListed).toBe(true) // buyerListedAffiliateProductWhere
  })
})

describe("loadHomeBestSellers7d — limit", () => {
  it("passes the limit to the ranking query, 12 by default", async () => {
    await loadHomeBestSellers7d(3)
    expect(rankedCall().values).toContain(3)

    db.sqlCalls = []
    await loadHomeBestSellers7d()
    expect(rankedCall().values).toContain(12)
  })
})

describe("loadHomeBestSellers7d — failures", () => {
  it("rejects when the ranking query fails (the error is not swallowed here) and runs nothing after it", async () => {
    const boom = Object.assign(new Error("Server has closed the connection."), { code: "P1017" })
    db.queryRaw.mockRejectedValue(boom)

    await expect(loadHomeBestSellers7d(3)).rejects.toBe(boom)

    expect(db.listingFindMany).not.toHaveBeenCalled()
    expect(db.profileFindMany).not.toHaveBeenCalled()
  })

  it("rejects when the listing query fails", async () => {
    db.ranked = [{ productId: "pA", c: big(9) }]
    const boom = new Error("listing query failed")
    db.listingFindMany.mockRejectedValue(boom)

    await expect(loadHomeBestSellers7d(3)).rejects.toBe(boom)
  })

  it("rejects when the sold-count query fails", async () => {
    db.ranked = [{ productId: "pA", c: big(9) }]
    db.listingFindMany.mockResolvedValue([listing("pA")])
    const boom = new Error("sold counts failed")
    db.queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
      if (strings.join("?").includes('INNER JOIN "Product"')) return db.ranked
      throw boom
    })

    await expect(loadHomeBestSellers7d(3)).rejects.toBe(boom)
  })

  it("does NOT reject when only the shipping-profile lookup fails: the cards come back with no delivery window (swallowed downstream)", async () => {
    db.ranked = [{ productId: "pA", c: big(9) }]
    db.listingFindMany.mockResolvedValue([listing("pA")])
    db.profileFindMany.mockRejectedValue(new Error("connection reset"))
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})

    const cards = await loadHomeBestSellers7d(3)

    expect(cards).toHaveLength(1)
    expect([cards[0]!.deliveryMin, cards[0]!.deliveryMax]).toEqual([null, null])
    expect(logged).toHaveBeenCalled() // logged by loadSupplierShopShippingOffersMap
  })

  it("looks the shop shipping windows up in ONE batched query over the distinct suppliers", async () => {
    db.ranked = [
      { productId: "pA", c: big(9) },
      { productId: "pB", c: big(8) },
      { productId: "pC", c: big(7) },
    ]
    db.listingFindMany.mockResolvedValue([
      listing("pA", {}, { supplierId: "s1" }),
      listing("pB", {}, { supplierId: "s2" }),
      listing("pC", {}, { supplierId: "s1" }),
    ])

    await loadHomeBestSellers7d(3)

    expect(db.profileFindMany).toHaveBeenCalledTimes(1)
    expect(db.profileFindMany.mock.calls[0]![0].where).toEqual({ userId: { in: ["s1", "s2"] } })
  })
})
