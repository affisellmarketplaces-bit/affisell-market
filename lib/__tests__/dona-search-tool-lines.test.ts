import { describe, expect, it } from "vitest"

import {
  buildDonaSearchToolLines,
  encodeDonaSearchRow,
  mergeDonaProductToolResults,
  parseDonaProductToolOutput,
} from "@/lib/dona/dona-search-tool-lines"
import type { DonaProductHit } from "@/lib/dona/dona-product-types"

const sampleHit: DonaProductHit = {
  listingId: "clisting123",
  productId: "cprod456",
  name: "Montre connectée Pro",
  price: 129.99,
  imageUrl: "https://example.com/img.jpg",
  brand: "Boutique Test",
  url: "/marketplace/clisting123",
}

describe("dona search tool lines", () => {
  it("encodes listing url for LLM citation", () => {
    const line = encodeDonaSearchRow(sampleHit, 0)
    const parsed = JSON.parse(line) as Record<string, unknown>
    expect(parsed.url).toBe("/marketplace/clisting123")
    expect(parsed.listingId).toBe("clisting123")
  })

  it("round-trips tool output with hub metadata", () => {
    const lines = [
      JSON.stringify({ t: "hub", url: "/bestsellers", window: "7d" }),
      encodeDonaSearchRow({ ...sampleHit, rank: 1, soldCount: 12 }, 0),
    ]
    const data = parseDonaProductToolOutput(lines)
    expect(data.hubUrl).toBe("/bestsellers")
    expect(data.products[0]?.rank).toBe(1)
    expect(data.products[0]?.soldCount).toBe(12)
  })

  it("merges duplicate tool calls into one rail", () => {
    const empty = parseDonaProductToolOutput(
      buildDonaSearchToolLines({
        products: [],
        similarProducts: [],
        suggestedCategories: ["Fashion"],
        hubUrl: null,
        hubWindow: null,
      })
    )
    const hit = parseDonaProductToolOutput([
      encodeDonaSearchRow({ ...sampleHit, rank: 1 }, 0),
    ])
    const merged = mergeDonaProductToolResults([empty, empty, hit])
    expect(merged.products).toHaveLength(1)
    expect(merged.suggestedCategories).toContain("Fashion")
  })

  it("parses category hints when no hits", () => {
    const lines = buildDonaSearchToolLines({
      products: [],
      similarProducts: [],
      suggestedCategories: ["Electronics", "Fashion"],
      hubUrl: null,
      hubWindow: null,
    })
    const data = parseDonaProductToolOutput(lines)
    expect(data.products).toEqual([])
    expect(data.suggestedCategories).toEqual(["Electronics", "Fashion"])
  })
})
