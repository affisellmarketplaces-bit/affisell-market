import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ logs: vi.fn(), products: vi.fn(), categories: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    categorySuggestionLog: { findMany: m.logs },
    product: { findMany: m.products },
    category: { findMany: m.categories },
  },
}))

import { loadCategoryEngineReport } from "@/lib/category-engine-accuracy.server"

const NOW = new Date("2026-10-03T12:00:00Z")
const at = (d: number) => new Date(NOW.getTime() - d * 86_400_000)

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
})

describe("loadCategoryEngineReport", () => {
  it("compares the engine's latest suggestion with each product's current category and names the corrections", async () => {
    m.logs.mockResolvedValue([
      { productId: "p1", leafId: "arts", confidence: 0.9, applied: true, createdAt: at(2) },
      { productId: "p2", leafId: "fig", confidence: 0.8, applied: true, createdAt: at(3) },
      { productId: "gone", leafId: "fig", confidence: 0.8, applied: true, createdAt: at(3) },
    ])
    m.products.mockResolvedValue([
      { id: "p1", name: "Spider-Man figure", categoryId: "toys" },
      { id: "p2", name: "Mug", categoryId: "fig" },
    ])
    m.categories.mockResolvedValue([
      { id: "arts", name: "Arts et loisirs" },
      { id: "toys", name: "Jeux et jouets" },
    ])

    const report = await loadCategoryEngineReport({ now: NOW })
    expect(report).toMatchObject({ windowDays: 90, products: 2, applied: 2, agreed: 1, corrected: 1, agreementRate: 0.5 })
    expect(report.topConfusionsNamed).toEqual([{ from: "Arts et loisirs", to: "Jeux et jouets", fromLeafId: "arts", toLeafId: "toys", count: 1 }])
    expect(report.corrections).toEqual([
      { productId: "p1", title: "Spider-Man figure", from: "Arts et loisirs", to: "Jeux et jouets", confidence: 0.9 },
    ])
  })

  it("reads a bounded, windowed sample", async () => {
    m.logs.mockResolvedValue([])
    await loadCategoryEngineReport({ windowDays: 30, now: NOW })
    const args = m.logs.mock.calls[0]![0]
    expect(args.where.createdAt.gte).toEqual(at(30))
    expect(args.take).toBe(5000)
    // an empty log needs no product / category lookups
    expect(m.products).not.toHaveBeenCalled()
    expect(m.categories).not.toHaveBeenCalled()
    await loadCategoryEngineReport({ windowDays: 9999, now: NOW })
    expect(m.logs.mock.calls[1]![0].where.createdAt.gte).toEqual(at(365))
  })

  it("caps the labelled examples it returns", async () => {
    m.logs.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ productId: `p${i}`, leafId: "a", confidence: 0.9, applied: true, createdAt: at(1) }))
    )
    m.products.mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `n${i}`, categoryId: "b" })))
    m.categories.mockResolvedValue([])
    const report = await loadCategoryEngineReport({ now: NOW, correctionsLimit: 2 })
    expect(report.corrected).toBe(5)
    expect(report.corrections).toHaveLength(2)
  })
})
