import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({ product: { findFirst: vi.fn() } }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { checkCatalogDuplicate } from "@/lib/catalog-duplicate-check"

beforeEach(() => {
  prismaMock.product.findFirst.mockReset()
})

describe("checkCatalogDuplicate", () => {
  it("returns false without a match", async () => {
    prismaMock.product.findFirst.mockResolvedValue(null)
    expect(await checkCatalogDuplicate("Montre connectée", "https://cdn/x.jpg")).toBe(false)
  })

  it("returns true when a candidate is found", async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: "p1" })
    expect(await checkCatalogDuplicate("Montre connectée", "https://cdn/x.jpg")).toBe(true)
  })

  it("matches on title prefix (max 40 chars) OR an exact tagged image URL", async () => {
    prismaMock.product.findFirst.mockResolvedValue(null)
    await checkCatalogDuplicate("A very long product title that keeps going on and on", "https://cdn/x.jpg")
    const where = prismaMock.product.findFirst.mock.calls[0]![0].where
    expect(where.OR).toEqual([
      { name: { contains: "A very long product title that keeps goi", mode: "insensitive" } },
      { tags: { has: "https://cdn/x.jpg" } },
    ])
  })

  it("short-circuits to false without a real title or image — never a wide-open query", async () => {
    expect(await checkCatalogDuplicate("", "")).toBe(false)
    expect(await checkCatalogDuplicate("   ", "  ")).toBe(false)
    expect(prismaMock.product.findFirst).not.toHaveBeenCalled()
  })

  it("scopes the match to one supplier when asked (SmartScan use case)", async () => {
    prismaMock.product.findFirst.mockResolvedValue(null)
    await checkCatalogDuplicate("Montre", "", { scopeSupplierId: "sup-1" })
    const where = prismaMock.product.findFirst.mock.calls[0]![0].where
    expect(where.supplierId).toBe("sup-1")
  })

  it("does not scope by supplier when not asked (DropForge platform-wide dedup use case)", async () => {
    prismaMock.product.findFirst.mockResolvedValue(null)
    await checkCatalogDuplicate("Montre", "")
    const where = prismaMock.product.findFirst.mock.calls[0]![0].where
    expect(where.supplierId).toBeUndefined()
  })
})
