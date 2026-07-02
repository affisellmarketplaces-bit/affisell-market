import { describe, expect, it } from "vitest"

import {
  BUYER_BROWSE_SIGNALS_MAX,
  collectCategoryHints,
  mergeBrowseSignalCategories,
  parseBrowseSignalsCookie,
} from "@/lib/buyer-browse-signals-shared"

describe("parseBrowseSignalsCookie", () => {
  it("returns empty for invalid input", () => {
    expect(parseBrowseSignalsCookie(undefined)).toEqual([])
    expect(parseBrowseSignalsCookie("")).toEqual([])
    expect(parseBrowseSignalsCookie("not-json")).toEqual([])
    expect(parseBrowseSignalsCookie("{}")).toEqual([])
  })

  it("dedupes case-insensitively and caps length", () => {
    const raw = JSON.stringify([
      "Electronics",
      " electronics ",
      "Fashion",
      "Home",
      "Garden",
      "Sports",
      "Toys",
      "Books",
    ])
    const parsed = parseBrowseSignalsCookie(raw)
    expect(parsed).toHaveLength(BUYER_BROWSE_SIGNALS_MAX)
    expect(parsed[0]).toBe("Electronics")
    expect(parsed).not.toContain(" electronics ")
  })
})

describe("mergeBrowseSignalCategories", () => {
  it("promotes latest category to front", () => {
    expect(mergeBrowseSignalCategories(["Fashion", "Home"], "Electronics")).toEqual([
      "Electronics",
      "Fashion",
      "Home",
    ])
  })

  it("ignores blank names", () => {
    expect(mergeBrowseSignalCategories(["Fashion"], "   ")).toEqual(["Fashion"])
  })

  it("merges multiple PDP categories in order", () => {
    let merged: string[] = []
    for (const name of ["Fashion", "Shoes", "Fashion"]) {
      merged = mergeBrowseSignalCategories(merged, name)
    }
    expect(merged).toEqual(["Fashion", "Shoes"])
  })
})

describe("collectCategoryHints", () => {
  it("weights browse signals higher than product categories", () => {
    const hints = collectCategoryHints({
      browseCategoryNames: ["Electronics"],
      productCategoryLists: [["Fashion"], ["Fashion"], ["Home"]],
    })
    expect(hints[0]).toBe("Electronics")
    expect(hints).toContain("Fashion")
  })

  it("preserves original casing from product lists", () => {
    const hints = collectCategoryHints({
      browseCategoryNames: [],
      productCategoryLists: [["Electronics & Gadgets"]],
    })
    expect(hints).toEqual(["Electronics & Gadgets"])
  })
})
