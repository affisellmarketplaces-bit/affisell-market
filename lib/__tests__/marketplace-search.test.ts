import { describe, expect, it } from "vitest"

import {
  expandMarketplaceSearchTerms,
  rankListingSearchHits,
  scoreListingSearchMatch,
} from "@/lib/marketplace-search"

describe("marketplace-search", () => {
  it("expands smartphone synonyms from téléphones mobiles", () => {
    const terms = expandMarketplaceSearchTerms("Téléphones mobiles 17 Pro Max")
    expect(terms).toContain("telephones")
    expect(terms).toContain("mobiles")
  })

  it("ranks trottinette listing above unrelated paths", () => {
    const docs = [
      {
        listingId: "scooter",
        title: "Trottinette électrique tout-terrain BMERY",
        description: "",
        categoryPath: "Équipements sportifs > Loisirs de plein air > Trottinettes",
        isFeatured: false,
        conversions: 3,
        clicks: 10,
      },
      {
        listingId: "battery",
        title: "Batterie outil jardin",
        description: "",
        categoryPath: "Maison et jardin > Pelouses > Batteries",
        isFeatured: false,
        conversions: 0,
        clicks: 0,
      },
    ]
    const hits = rankListingSearchHits(docs, "trottinette electrique", 5)
    expect(hits[0]?.listingId).toBe("scooter")
  })

  it("scores dashcam title highly on vehicle camera path", () => {
    const score = scoreListingSearchMatch(
      {
        listingId: "cam",
        title: "Caméra de voiture REDTIGER 3 canaux 4K",
        description: "",
        categoryPath:
          "Véhicules et accessoires > Pièces détachées > Électronique pour véhicules > Caméras de recul",
        isFeatured: false,
        conversions: 1,
        clicks: 0,
      },
      "caméra de voiture dashcam"
    )
    expect(score).toBeGreaterThan(15)
  })
})
