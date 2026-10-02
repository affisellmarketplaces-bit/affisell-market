import { beforeEach, describe, expect, it, vi } from "vitest"

const { classifyAffisellProduct, update, reviewCreate, reviewDeleteMany } = vi.hoisted(() => ({
  classifyAffisellProduct: vi.fn(),
  update: vi.fn(),
  reviewCreate: vi.fn(),
  reviewDeleteMany: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/ai/classify-product", () => ({ classifyAffisellProduct }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ product: { update }, productReview: { create: reviewCreate, deleteMany: reviewDeleteMany } }),
  },
}))

import { autoCategorizeProduct } from "@/lib/product-auto-categorize"

const ROWS = [
  { id: "toys", name: "Jeux et jouets", parentId: null, icon: "", order: 0 },
  { id: "fig", name: "Figurines jouets", parentId: "toys", icon: "", order: 1 },
  { id: "arts", name: "Arts et loisirs", parentId: null, icon: "", order: 2 },
  { id: "foot", name: "Articles de football dédicacés", parentId: "arts", icon: "", order: 3 },
]

function clientFor(name: string) {
  return {
    category: { findMany: vi.fn().mockResolvedValue(ROWS) },
    product: {
      findUnique: vi.fn().mockResolvedValue({
        id: "p1",
        name,
        description: "",
        images: [],
        categoryId: null,
        isDraft: false,
        active: true,
      }),
    },
  } as never
}

const SPIDERMAN = "Marvel Spider Man Articulated Action Figure Collectible Adult Collection Home Decoration"

describe("autoCategorizeProduct — a keyword match alone never writes a category", () => {
  beforeEach(() => {
    classifyAffisellProduct.mockReset()
    update.mockReset()
    reviewCreate.mockReset()
    reviewDeleteMany.mockReset()
  })

  it("leaves the product uncategorised when no engine answers (it used to apply a keyword guess)", async () => {
    classifyAffisellProduct.mockResolvedValue({ suggestions: [] })
    const out = await autoCategorizeProduct("p1", { client: clientFor(SPIDERMAN) })
    expect(out).toEqual({ ok: true, applied: false, reason: "low_confidence" })
    expect(update).not.toHaveBeenCalled()
  })

  it("hands the FULL taxonomy to the classifier, not a lexically pre-filtered shortlist", async () => {
    classifyAffisellProduct.mockResolvedValue({ suggestions: [] })
    await autoCategorizeProduct("p1", { client: clientFor(SPIDERMAN) })
    const ctx = classifyAffisellProduct.mock.calls[0]![1]
    expect(ctx.leafPaths.map((l: { leafId: string }) => l.leafId).sort()).toEqual(["fig", "foot"])
  })

  it("applies a confident AI pick", async () => {
    classifyAffisellProduct.mockResolvedValue({
      suggestions: [{ category: "Jeux et jouets > Figurines jouets", confidence: 0.9, reason: "toy", leafId: "fig" }],
    })
    const out = await autoCategorizeProduct("p1", { client: clientFor(SPIDERMAN) })
    expect(out).toMatchObject({ ok: true, applied: true, leafId: "fig", source: "ai" })
    expect(update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { categoryId: "fig" } })
    expect(reviewCreate).not.toHaveBeenCalled()
  })

  it("applies a middling AI pick but queues it for review", async () => {
    classifyAffisellProduct.mockResolvedValue({
      suggestions: [{ category: "Jeux et jouets > Figurines jouets", confidence: 0.6, reason: "toy", leafId: "fig" }],
    })
    const out = await autoCategorizeProduct("p1", { client: clientFor(SPIDERMAN) })
    expect(out).toMatchObject({ applied: true, needsReview: true })
    expect(reviewCreate).toHaveBeenCalledTimes(1)
  })

  it("does not apply a weak AI pick", async () => {
    classifyAffisellProduct.mockResolvedValue({
      suggestions: [{ category: "Arts > Football", confidence: 0.3, reason: "?", leafId: "foot" }],
    })
    const out = await autoCategorizeProduct("p1", { client: clientFor(SPIDERMAN) })
    expect(out).toEqual({ ok: true, applied: false, reason: "low_confidence" })
    expect(update).not.toHaveBeenCalled()
  })
})
