import { describe, expect, it } from "vitest"

import { parseCatalogHighlightsToolOutput } from "@/lib/agent-affiliate-highlights-parse"

describe("parseCatalogHighlightsToolOutput", () => {
  it("groups rows by h bucket and maps product fields", () => {
    const raw = [
      JSON.stringify({
        h: 0,
        id: "p1",
        name: "Leggings",
        imageUrl: "https://cdn.example/a.jpg",
        supplierLabel: "FitCo",
        basePriceCents: 2000,
        commissionRate: 15,
        marginCents: 900,
        sold7d: 12,
        isInStore: true,
        listingId: "lst1",
      }),
      JSON.stringify({
        h: 2,
        id: "p2",
        name: "Watch",
        basePriceCents: 5000,
        commissionRate: 20,
        marginCents: 2500,
        isInStore: false,
      }),
    ]

    const parsed = parseCatalogHighlightsToolOutput(raw)
    expect(parsed?.bestSellers).toHaveLength(1)
    expect(parsed?.bestSellers[0]?.id).toBe("p1")
    expect(parsed?.bestSellers[0]?.marginCents).toBe(900)
    expect(parsed?.bestSellers[0]?.isInStore).toBe(true)
    expect(parsed?.highMargin).toHaveLength(1)
    expect(parsed?.highMargin[0]?.name).toBe("Watch")
    expect(parsed?.newArrivals).toHaveLength(0)
  })

  it("returns null for empty output", () => {
    expect(parseCatalogHighlightsToolOutput([])).toBeNull()
    expect(parseCatalogHighlightsToolOutput(["not-json"])).toBeNull()
  })
})
