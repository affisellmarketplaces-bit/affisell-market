import { describe, expect, it, vi } from "vitest"

import { categorySubtreeGraphFromRows } from "@/lib/category-browse-shared"
import { buildCategoryScopeProductFilter } from "@/lib/marketplace-category-product-filter"

vi.mock("@/lib/category-subtree-graph.server", () => ({
  getCategorySubtreeGraph: vi.fn(),
}))

import { getCategorySubtreeGraph } from "@/lib/category-subtree-graph.server"

describe("buildCategoryScopeProductFilter", () => {
  it("matches only categoryId in subtree and tabular subcategories under scope", async () => {
    vi.mocked(getCategorySubtreeGraph).mockResolvedValue(
      categorySubtreeGraphFromRows([
        { id: "root", parentId: null, name: "Root Dept", fullPath: "Root Dept" },
        { id: "leaf", parentId: "root", name: "Leaf Aisle", fullPath: "Root Dept > Leaf Aisle" },
      ])
    )

    const subcategory = {
      findMany: vi.fn().mockResolvedValue([{ id: "sub-tab-1" }]),
    }
    const client = { subcategory } as unknown as Parameters<
      typeof buildCategoryScopeProductFilter
    >[0]

    const where = await buildCategoryScopeProductFilter(client, "root")

    expect(where.OR).toEqual(
      expect.arrayContaining([
        { categoryId: { in: expect.arrayContaining(["root", "leaf"]) } },
        { subcategoryId: { in: ["sub-tab-1"] } },
        { categories: { hasSome: expect.any(Array) } },
      ])
    )
    expect(subcategory.findMany).toHaveBeenCalledWith({
      where: { categoryId: { in: expect.arrayContaining(["root", "leaf"]) } },
      select: { id: true },
    })
  })
})
