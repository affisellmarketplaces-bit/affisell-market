import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))

const battleFindMany = vi.hoisted(() => vi.fn())
const listingFindMany = vi.hoisted(() => vi.fn())
vi.mock("@/lib/prisma", () => ({
  prisma: { pulseBattle: { findMany: battleFindMany }, affiliateProduct: { findMany: listingFindMany } },
  withPrismaReconnect: <T,>(fn: () => Promise<T>) => fn(),
}))
vi.mock("@/lib/pulse/ensure-battle-schema", () => ({ ensurePulseBattleSchema: async () => true }))

import { loadFlashDealsUncached } from "@/lib/home-flash-shops.server"

const inMin = (m: number) => new Date(Date.now() + m * 60_000)
const battle = (over: Record<string, unknown> = {}) => ({
  id: "b1",
  winnerId: "p1",
  flashDiscount: 20,
  flashEndsAt: inMin(4),
  flashDiscountSetBy: "aff-setter",
  priceReferenceCents: 9000,
  ...over,
})
const listing = (over: Record<string, unknown> = {}) => ({
  id: "l1",
  affiliateId: "aff-setter",
  productId: "p1",
  sellingPriceCents: 10000,
  customImages: [],
  customTitle: null,
  product: { name: "Gadget", images: ["https://cdn.example/g.jpg"] },
  ...over,
})

describe("home flash deals — only what the product page would honour", () => {
  beforeEach(() => {
    battleFindMany.mockReset()
    listingFindMany.mockReset()
  })

  it("prices the deal like the PDP (discount on the usual price) and links with the battle id", async () => {
    battleFindMany.mockResolvedValue([battle()])
    listingFindMany.mockResolvedValue([listing()])
    const [d] = await loadFlashDealsUncached()
    expect(d.flashPriceCents).toBe(8000)
    expect(d.usualPriceCents).toBe(10000)
    expect(d.pct).toBe(20)
    expect(d.referenceCents).toBe(9000)
    expect(d.href).toBe("/marketplace/l1?battleId=b1")
  })

  it("prefers the listing of the reseller who set the flash", async () => {
    battleFindMany.mockResolvedValue([battle()])
    listingFindMany.mockResolvedValue([listing({ id: "other", affiliateId: "someone" }), listing({ id: "mine" })])
    expect((await loadFlashDealsUncached())[0]?.href).toContain("/marketplace/mine")
  })

  it("skips a winner nobody lists and a listing without an image", async () => {
    battleFindMany.mockResolvedValue([battle({ id: "b2", winnerId: "p2" }), battle({ id: "b3", winnerId: "p3" })])
    listingFindMany.mockResolvedValue([listing({ productId: "p3", product: { name: "No image", images: [] } })])
    expect(await loadFlashDealsUncached()).toEqual([])
  })

  it("asks the database only for battles that still have time left", async () => {
    battleFindMany.mockResolvedValue([])
    await loadFlashDealsUncached()
    const where = battleFindMany.mock.calls[0]![0].where
    expect(where.status).toBe("ended")
    expect(where.flashEndsAt.gt.getTime()).toBeGreaterThan(Date.now())
  })

  it("returns [] (never throws) when the battle tables are unavailable", async () => {
    battleFindMany.mockRejectedValue(new Error("relation does not exist"))
    await expect(loadFlashDealsUncached()).resolves.toEqual([])
  })
})
