import { readFileSync } from "node:fs"

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))

const battleFindMany = vi.hoisted(() => vi.fn())
const listingFindMany = vi.hoisted(() => vi.fn())
/** Every way the client could run DDL / raw SQL / open a transaction: none may be touched by the Home flash path. */
const rawSql = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn(),
  $executeRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}))
const ensureSchema = vi.hoisted(() => vi.fn(async () => true))
vi.mock("@/lib/prisma", () => ({
  prisma: { pulseBattle: { findMany: battleFindMany }, affiliateProduct: { findMany: listingFindMany }, ...rawSql },
  withPrismaReconnect: <T,>(fn: () => Promise<T>) => fn(),
}))
vi.mock("@/lib/pulse/ensure-battle-schema", () => ({ ensurePulseBattleSchema: ensureSchema }))

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
    ensureSchema.mockClear()
    for (const fn of Object.values(rawSql)) fn.mockClear()
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

describe("home flash deals — no schema work (DDL) on the Home request path", () => {
  beforeEach(() => {
    battleFindMany.mockReset()
    listingFindMany.mockReset()
    ensureSchema.mockClear()
    for (const fn of Object.values(rawSql)) fn.mockClear()
  })

  it("does not call ensurePulseBattleSchema, whether it finds deals, nothing, or a missing table", async () => {
    battleFindMany.mockResolvedValueOnce([battle()])
    listingFindMany.mockResolvedValueOnce([listing()])
    expect(await loadFlashDealsUncached()).toHaveLength(1)

    battleFindMany.mockResolvedValueOnce([])
    expect(await loadFlashDealsUncached()).toEqual([])

    battleFindMany.mockRejectedValueOnce(new Error("relation does not exist"))
    expect(await loadFlashDealsUncached()).toEqual([])

    expect(ensureSchema).not.toHaveBeenCalled()
  })

  it("runs no raw SQL, no DDL and no transaction: only the two business reads", async () => {
    battleFindMany.mockResolvedValue([battle()])
    listingFindMany.mockResolvedValue([listing()])
    await loadFlashDealsUncached()

    for (const [name, fn] of Object.entries(rawSql)) expect(fn, name).not.toHaveBeenCalled()
    expect(battleFindMany).toHaveBeenCalledTimes(1)
    expect(listingFindMany).toHaveBeenCalledTimes(1)
  })

  it("still loads nothing but the business reads when there is no battle to show", async () => {
    battleFindMany.mockResolvedValue([])
    await expect(loadFlashDealsUncached()).resolves.toEqual([])
    expect(listingFindMany).not.toHaveBeenCalled() // no winners → the listing query is skipped, as before
    for (const fn of Object.values(rawSql)) expect(fn).not.toHaveBeenCalled()
  })

  it("keeps the module free of schema work: no ensure import, no raw execute, no CREATE/ALTER/DROP statement", () => {
    const source = readFileSync("lib/home-flash-shops.server.ts", "utf8")
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
    expect(code).not.toMatch(/ensurePulseBattleSchema|ensure-battle-schema/)
    expect(code).not.toMatch(/\$executeRaw/)
    expect(code).not.toMatch(/\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|COLUMN|CONSTRAINT)\b/i)
  })
})
