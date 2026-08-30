import { describe, expect, it } from "vitest"

import {
  buildDonaSearchToolLines,
  encodeDonaSearchRow,
  parseDonaSearchToolOutput,
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

  it("round-trips tool output", () => {
    const lines = buildDonaSearchToolLines({
      products: [sampleHit],
      similarProducts: [],
      suggestedCategories: [],
    })
    const data = parseDonaSearchToolOutput(lines)
    expect(data?.products[0]?.url).toBe("/marketplace/clisting123")
    expect(data?.products[0]?.name).toBe("Montre connectée Pro")
  })

  it("parses category hints when no hits", () => {
    const lines = buildDonaSearchToolLines({
      products: [],
      similarProducts: [],
      suggestedCategories: ["Electronics", "Fashion"],
    })
    const data = parseDonaSearchToolOutput(lines)
    expect(data?.products).toEqual([])
    expect(data?.suggestedCategories).toEqual(["Electronics", "Fashion"])
  })
})
