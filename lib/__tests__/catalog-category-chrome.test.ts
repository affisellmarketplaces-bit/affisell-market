import { describe, expect, it } from "vitest"

import { chunkCategoryRoots } from "@/lib/category-tree-tiers"
import {
  allTiersCollapsed,
  collapseAllTiers,
  expandAllTiers,
  parseCatalogCategoryChrome,
  toggleCollapsedTier,
} from "@/lib/catalog-category-chrome"

describe("parseCatalogCategoryChrome", () => {
  it("returns open chrome for empty input", () => {
    expect(parseCatalogCategoryChrome(null).docked).toBe(false)
    expect(parseCatalogCategoryChrome("").collapsedTiers).toEqual([false, false, false])
  })

  it("parses docked cinema mode", () => {
    const state = parseCatalogCategoryChrome(
      JSON.stringify({ docked: true, collapsedTiers: [true, true, false] })
    )
    expect(state.docked).toBe(true)
    expect(state.collapsedTiers).toEqual([true, true, false])
  })

  it("ignores garbage JSON", () => {
    expect(parseCatalogCategoryChrome("{not json").docked).toBe(false)
  })
})

describe("tier collapse helpers", () => {
  it("toggles a single aisle group", () => {
    expect(toggleCollapsedTier([false, false, false], 1)).toEqual([false, true, false])
    expect(toggleCollapsedTier([false, true, false], 1)).toEqual([false, false, false])
  })

  it("treats all listed tiers as collapsed", () => {
    expect(allTiersCollapsed([true, true, false], 2)).toBe(true)
    expect(allTiersCollapsed([true, false, false], 2)).toBe(false)
    expect(allTiersCollapsed(collapseAllTiers(), 3)).toBe(true)
    expect(allTiersCollapsed(expandAllTiers(), 3)).toBe(false)
  })
})

describe("chunkCategoryRoots", () => {
  it("splits into up to three balanced tiers", () => {
    const items = [1, 2, 3, 4, 5, 6, 7]
    expect(chunkCategoryRoots(items)).toEqual([[1, 2, 3], [4, 5, 6], [7]])
  })
})
