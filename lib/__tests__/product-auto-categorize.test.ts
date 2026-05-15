import { describe, expect, it } from "vitest"

import {
  buildCategoryBrowse,
  scoreTitleAgainstBreadcrumb,
  suggestLeafCategoriesFromTitle,
} from "@/lib/category-browse"

describe("product auto-categorize heuristics", () => {
  const rows = [
    { id: "root-el", name: "Electronics", parentId: null, icon: "📱", order: 1 },
    { id: "leaf-audio", name: "Audio & Headphones", parentId: "root-el", icon: "🎧", order: 1 },
    { id: "root-home", name: "Home & Kitchen", parentId: null, icon: "🏡", order: 2 },
    { id: "leaf-cook", name: "Cookware & Bakeware", parentId: "root-home", icon: "🍳", order: 1 },
  ]

  const { leafPaths } = buildCategoryBrowse(rows)

  it("scores wireless headphones toward audio leaf", () => {
    const audio = leafPaths.find((lp) => lp.leafId === "leaf-audio")!
    const score = scoreTitleAgainstBreadcrumb(
      "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
      audio.breadcrumb
    )
    expect(score).toBeGreaterThanOrEqual(7)
  })

  it("suggests relevant leaf from product title", () => {
    const picks = suggestLeafCategoriesFromTitle("Stainless steel frying pan 28cm", leafPaths, 2)
    expect(picks.some((p) => p.leafId === "leaf-cook")).toBe(true)
  })
})
