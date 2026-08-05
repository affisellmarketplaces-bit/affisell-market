import { describe, expect, it } from "vitest"

import type { LeafPath } from "@/lib/category-browse"
import {
  hasSoftRescueSignal,
  softRescueCategorySuggestions,
} from "@/lib/category-soft-rescue"
import { suggestLeafCategoriesFromProductText } from "@/lib/category-title-match"
import { buildListingProductContext } from "@/lib/listing-product-signal"

const LEAVES: LeafPath[] = [
  {
    leafId: "backpack",
    breadcrumb: "Bagages et maroquinerie > Sacs à dos",
    path: [],
  },
  {
    leafId: "sneakers",
    breadcrumb: "Vêtements et accessoires > Chaussures > Baskets",
    path: [],
  },
  {
    leafId: "tablet",
    breadcrumb: "Appareils électroniques > Ordinateurs > Tablettes multimédias",
    path: [],
  },
  {
    leafId: "tablet-case",
    breadcrumb:
      "Appareils électroniques > Accessoires électroniques > Accessoires pour tablettes > Housses pour tablettes",
    path: [],
  },
  {
    leafId: "desk-lamp",
    breadcrumb: "Maison et jardin > Luminaires > Lampes",
    path: [],
  },
  {
    leafId: "security-lamp",
    breadcrumb: "Maison et jardin > Sécurité à domicile et au bureau > Lampes de sécurité",
    path: [],
  },
  {
    leafId: "stroller",
    breadcrumb: "Bébés et tout-petits > Poussettes",
    path: [],
  },
  {
    leafId: "dog-leash",
    breadcrumb:
      "Animaux et articles pour animaux de compagnie > Articles pour animaux de compagnie > Colliers et harnais pour animaux de compagnie",
    path: [],
  },
  {
    leafId: "duvet-cover",
    breadcrumb: "Maison et jardin > Linge > Literie > Housses de couette",
    path: [],
  },
  {
    leafId: "necklace",
    breadcrumb: "Vêtements et accessoires > Bijoux > Colliers",
    path: [],
  },
  {
    leafId: "activity",
    breadcrumb: "Santé et beauté > Santé > Moniteurs biométriques > Moniteurs d'activité",
    path: [],
  },
  {
    leafId: "obscure",
    breadcrumb: "Entreprise et industrie > Signalétique > Chevalets stop-trottoir",
    path: [],
  },
]

describe("category-soft-rescue + coverage intents", () => {
  it("suggests backpack for sac à dos titles", () => {
    const picks = suggestLeafCategoriesFromProductText(
      "Sac à dos voyage impermeable 40L",
      "",
      LEAVES,
      3
    )
    expect(picks[0]?.leafId).toBe("backpack")
  })

  it("suggests sneakers for basket titles", () => {
    const picks = suggestLeafCategoriesFromProductText(
      "Baskets running homme légères",
      "",
      LEAVES,
      3
    )
    expect(picks[0]?.leafId).toBe("sneakers")
  })

  it("suggests tablets ahead of tablet cases", () => {
    const picks = suggestLeafCategoriesFromProductText(
      "Tablette Android 14 écran 10 pouces",
      "",
      LEAVES,
      3
    )
    expect(picks[0]?.leafId).toBe("tablet")
    expect(picks.some((p) => p.leafId === "tablet-case")).toBe(false)
  })

  it("suggests home lamps, not security lamps", () => {
    const picks = suggestLeafCategoriesFromProductText(
      "Lampe de bureau LED tactile",
      "",
      LEAVES,
      3
    )
    expect(picks[0]?.leafId).toBe("desk-lamp")
    expect(picks.some((p) => p.leafId === "security-lamp")).toBe(false)
  })

  it("suggests baby stroller and dog leash intents", () => {
    expect(
      suggestLeafCategoriesFromProductText("Poussette bébé 3 roues légère", "", LEAVES, 2)[0]
        ?.leafId
    ).toBe("stroller")
    expect(
      suggestLeafCategoriesFromProductText("Laisse chien réglable nylon", "", LEAVES, 2)[0]
        ?.leafId
    ).toBe("dog-leash")
  })

  it("suggests bedding and fashion jewelry", () => {
    expect(
      suggestLeafCategoriesFromProductText("Housse de couette coton 220x240", "", LEAVES, 2)[0]
        ?.leafId
    ).toBe("duvet-cover")
    expect(
      suggestLeafCategoriesFromProductText("Collier fantaisie doré femme", "", LEAVES, 2)[0]
        ?.leafId
    ).toBe("necklace")
  })

  it("soft-rescues when strict scoring would miss but title has signal", () => {
    const obscureLeaves: LeafPath[] = [
      {
        leafId: "backpack",
        breadcrumb: "Bagages et maroquinerie > Sacs à dos",
        path: [],
      },
      {
        leafId: "obscure",
        breadcrumb: "Entreprise et industrie > Signalétique > Chevalets stop-trottoir",
        path: [],
      },
    ]
    /** Title with real product nouns but force soft path via softRescue API directly. */
    const ctx = buildListingProductContext("Sac à dos voyage impermeable 40L")
    expect(hasSoftRescueSignal(ctx)).toBe(true)
    const soft = softRescueCategorySuggestions(ctx, obscureLeaves, 3)
    expect(soft.length).toBeGreaterThan(0)
    expect(soft[0]?.leafId).toBe("backpack")
  })

  it("does not soft-rescue vague titles without product nouns", () => {
    const ctx = buildListingProductContext("Pro Max")
    expect(hasSoftRescueSignal(ctx)).toBe(false)
    expect(softRescueCategorySuggestions(ctx, LEAVES, 3)).toEqual([])
  })
})
