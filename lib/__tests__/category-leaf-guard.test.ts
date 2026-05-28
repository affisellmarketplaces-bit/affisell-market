import { beforeEach, describe, expect, it, vi } from "vitest"

const { findUnique } = vi.hoisted(() => ({
  findUnique: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: { findUnique },
  },
}))

import { normalizeLeafCategoryId } from "@/lib/category-leaf-guard"

describe("normalizeLeafCategoryId", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null for empty input", async () => {
    await expect(normalizeLeafCategoryId("")).resolves.toBeNull()
    expect(findUnique).not.toHaveBeenCalled()
  })

  it("returns the id when category is a leaf", async () => {
    findUnique.mockResolvedValue({ id: "cat_leaf", isLeaf: true })
    await expect(normalizeLeafCategoryId("cat_leaf")).resolves.toBe("cat_leaf")
  })

  it("throws CATEGORY_NOT_FOUND when missing", async () => {
    findUnique.mockResolvedValue(null)
    await expect(normalizeLeafCategoryId("missing")).rejects.toThrow("CATEGORY_NOT_FOUND")
  })

  it("throws CATEGORY_NOT_LEAF when category is not leaf", async () => {
    findUnique.mockResolvedValue({ id: "cat_parent", isLeaf: false })
    await expect(normalizeLeafCategoryId("cat_parent")).rejects.toThrow("CATEGORY_NOT_LEAF")
  })
})
