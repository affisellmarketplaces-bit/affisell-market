import { NextRequest, NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  rateLimitKey: vi.fn(),
  catFindFirst: vi.fn(),
  catFindMany: vi.fn(),
  prodFindMany: vi.fn(),
  groupBy: vi.fn(),
  groq: vi.fn(),
  card: vi.fn(),
  cacheCalls: [] as Array<{ keyParts: string[]; opts: { revalidate?: number; tags?: string[] } }>,
}))

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown, keyParts: string[], opts: { revalidate?: number; tags?: string[] }) => {
    m.cacheCalls.push({ keyParts, opts })
    return fn
  },
}))
vi.mock("@/lib/api-rate-limit", () => ({
  rateLimitClientKey: m.rateLimitKey,
  rateLimitResponseAsync: m.rateLimit,
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: { findFirst: m.catFindFirst, findMany: m.catFindMany },
    product: { findMany: m.prodFindMany },
    affisellTrackEvent: { groupBy: m.groupBy },
  },
}))
vi.mock("@/lib/marketplace-affiliate-listing-filter", () => ({ affiliateRoleMarketplaceWhere: {} }))
vi.mock("@/lib/prisma-db-error", () => ({ dbUnavailablePayload: () => ({ code: "db_unavailable" }) }))
vi.mock("@/lib/ai/groq-client", () => ({ groqChatText: m.groq }))
vi.mock("@/lib/merchandise/generate-card", () => ({ generateCategoryCard: m.card }))

import { GET } from "@/app/api/merchandise/generate/route"
import { resolveMerchandisingDepartment } from "@/lib/merchandise/templates"

const call = (category: string) =>
  GET(new NextRequest(`http://localhost/api/merchandise/generate?category=${encodeURIComponent(category)}`))

const product = (id: string, price: number) => ({
  id,
  name: `Product ${id}`,
  images: [`https://cdn.example.test/${id}.png`],
  basePriceCents: price,
  categoryId: "root1",
  categories: ["Gadgets"],
  category: { id: "root1", name: "Electronics", parentId: null },
  affiliateProducts: [{ id: `listing_${id}` }],
})

beforeEach(() => {
  for (const fn of Object.values(m)) if (typeof fn === "function") fn.mockReset()
  m.cacheCalls.length = 0
  vi.unstubAllEnvs()
  vi.stubEnv("GROQ_API_KEY", "test-key")
  m.rateLimit.mockResolvedValue(null)
  m.rateLimitKey.mockReturnValue("ip:203.0.113.9")
  m.catFindFirst.mockResolvedValue({ id: "root1", name: "Electronics", slug: "electronics" })
  m.catFindMany.mockResolvedValue([])
  m.prodFindMany.mockResolvedValue([product("p1", 1000), product("p2", 5000)])
  m.groupBy.mockResolvedValue([{ productId: "p1", _count: { _all: 3 } }])
  m.groq.mockResolvedValue('"Gadgets You Love"')
  m.card.mockResolvedValue(Buffer.from("png"))
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

describe("GET /api/merchandise/generate (public)", () => {
  it("is limited per client before any database or image work", async () => {
    m.rateLimit.mockResolvedValue(NextResponse.json({ error: "rate_limit" }, { status: 429 }))
    const res = await call("Electronics")

    expect(res.status).toBe(429)
    expect(m.rateLimit).toHaveBeenCalledWith("ip:203.0.113.9", { limit: 30, windowMs: 60_000, prefix: "merch-generate" })
    expect(m.catFindFirst).not.toHaveBeenCalled()
    expect(m.card).not.toHaveBeenCalled()
  })

  it("rejects an unknown department with 400, before touching the database", async () => {
    const res = await call("../../etc/passwd")

    expect(res.status).toBe(400)
    expect(m.catFindFirst).not.toHaveBeenCalled()
  })

  it("builds the block through a one-hour cache keyed by the department", async () => {
    const resolved = resolveMerchandisingDepartment("Electronics")!
    const res = await call("Electronics")

    expect(res.status).toBe(200)
    expect(m.cacheCalls).toHaveLength(1)
    expect(m.cacheCalls[0]!.opts.revalidate).toBe(3600)
    expect(m.cacheCalls[0]!.keyParts).toContain(resolved.dbRootName)
  })

  it("returns the block: best-scoring products first, headline from the model, links to the listings", async () => {
    const body = await (await call("Electronics")).json()

    expect(body).toMatchObject({ title: "Gadgets You Love", categoryId: "root1", browseSlug: "electronics" })
    // p2 (5000 * 0 views) scores 0, p1 (1000 * 3 views) scores 3000 → p1 first
    expect(body.items.map((i: { href: string }) => i.href)).toEqual(["/marketplace/listing_p1", "/marketplace/listing_p2"])
    expect(body.items[0].image).toBe("/generated/categories/p1.png")
    expect(m.card).toHaveBeenCalledTimes(2)
  })

  it("falls back to a plain title when the model fails", async () => {
    m.groq.mockRejectedValue(new Error("groq down"))
    const body = await (await call("Electronics")).json()

    expect(body.title).toBe("Top picks in Electronics")
  })

  it("answers 404 for a department that is not seeded, as an error the cache never stores", async () => {
    m.catFindFirst.mockResolvedValue(null)
    const res = await call("Electronics")

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Category not seeded in database" })
  })

  it("answers 503 with an empty block when the database is unavailable", async () => {
    m.catFindFirst.mockRejectedValue(new Error("db down"))
    const res = await call("Electronics")

    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ items: [], title: "", categoryId: null })
  })
})
