import { describe, expect, it, vi } from "vitest"

import { buildCategoryScopeProductFilter } from "@/lib/marketplace-category-product-filter"

describe("buildCategoryScopeProductFilter", () => {
  it("matches only categoryId in subtree and tabular subcategories under scope", async () => {
    const subcategory = {
      findMany: vi.fn().mockResolvedValue([{ id: "sub-tab-1" }]),
    }
    const category = {
      findMany: vi
        .fn()
        .mockResolvedValueOnce([
          { id: "root", parentId: null },
          { id: "leaf", parentId: "root" },
        ])
        .mockResolvedValueOnce([
          { id: "root", name: "Root Dept", fullPath: "Root Dept" },
          { id: "leaf", name: "Leaf Aisle", fullPath: "Root Dept > Leaf Aisle" },
        ]),
    }
    const client = { category, subcategory } as unknown as Parameters<
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
