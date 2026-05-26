import { describe, expect, it } from "vitest"

import {
  buildListingProductContext,
  buildSupplierHintsForCategory,
  categoryOnlyMatchesDescriptionNoise,
  extractProductIdentityFromTitle,
  formatListingContextForAi,
} from "@/lib/listing-product-signal"
import {
  isCategorySuggestionViable,
  scoreProductTextAgainstBreadcrumb,
  suggestLeafCategoriesFromProductText,
} from "@/lib/category-title-match"
import type { LeafPath } from "@/lib/category-browse"

const MOSQUITO_LEAVES: LeafPath[] = [
  {
    leafId: "window-screen",
    breadcrumb: "Maison et jardin > Décorations > Habillages de fenêtre > Moustiquaires pour fenêtre",
    path: [],
  },
  {
    leafId: "camping-net",
    breadcrumb: "Équipements sportifs > Loisirs de plein air > Camping et randonnée > Moustiquaires",
    path: [],
  },
  {
    leafId: "office-glue",
    breadcrumb:
      "Arts et loisirs > Artisanat > Matériel de loisirs créatifs > Adhésifs et aimants > Colle pour le bureau",
    path: [],
  },
  {
    leafId: "aquarium",
    breadcrumb:
      "Animaux et articles pour animaux de compagnie > Accessoires pour poissons > Produits d'entretien pour aquariums",
    path: [],
  },
]

describe("extractProductIdentityFromTitle", () => {
  it("extracts ventilateur from noisy marketplace title", () => {
    const r = extractProductIdentityFromTitle(
      "Ventilateur portable USB rechargeable mini bureau | Livraison gratuite | Noir"
    )
    expect(r.productName.toLowerCase()).toContain("ventilateur")
    expect(r.productName.toLowerCase()).not.toContain("livraison")
  })

  it("strips brand prefix before product noun", () => {
    const r = extractProductIdentityFromTitle(
      "4UMOR Moustiquaire Porte Fenêtre Magnétique Rideau"
    )
    expect(r.productName.toLowerCase()).toContain("moustiquaire")
    expect(r.productName.toLowerCase()).not.toMatch(/^4umor/)
  })
})

describe("buildSupplierHintsForCategory", () => {
  it("excludes long SEO description that only mentions accessories", () => {
    const seo =
      "Worried about mosquitoes in summer? This magnetic door screen features a 4cm wide adhesive band for easy installation. Premium quality mesh keeps insects out while allowing fresh air."
    const { hints, descriptionExcluded } = buildSupplierHintsForCategory(
      "4UMOR Moustiquaire Porte Fenêtre Magnétique",
      seo,
      ["Installation sans outil"]
    )
    expect(descriptionExcluded).toBe(true)
    expect(hints.toLowerCase()).not.toContain("adhesive")
    expect(hints).toContain("Installation sans outil")
  })
})

describe("moustiquaire categorization", () => {
  const title = "4UMOR Moustiquaire Porte Fenêtre Magnétique Rideau"
  const seoDescription =
    "Bande adhésive 4cm, installation facile, maille magnétique anti-moustiques pour porte et fenêtre."

  it("ranks moustiquaire categories above glue and aquarium", () => {
    const ctx = buildListingProductContext(title, { description: seoDescription })
    const windowScore = scoreProductTextAgainstBreadcrumb(ctx.classificationFocus, MOSQUITO_LEAVES[0]!.breadcrumb)
    const glueScore = scoreProductTextAgainstBreadcrumb(seoDescription, MOSQUITO_LEAVES[2]!.breadcrumb)
    const windowListing = scoreProductTextAgainstBreadcrumb(ctx.classificationFocus, MOSQUITO_LEAVES[0]!.breadcrumb)

    expect(windowListing).toBeGreaterThan(glueScore)
    expect(windowScore).toBeGreaterThan(
      scoreProductTextAgainstBreadcrumb(ctx.classificationFocus, MOSQUITO_LEAVES[3]!.breadcrumb)
    )
  })

  it("suggests window or camping moustiquaire leaves, not glue", () => {
    const ctx = buildListingProductContext(title, { description: seoDescription })
    const picks = suggestLeafCategoriesFromProductText(
      ctx.classificationFocus,
      "",
      MOSQUITO_LEAVES,
      3
    )
    expect(picks.length).toBeGreaterThan(0)
    expect(picks.some((p) => /moustiquaire/i.test(p.breadcrumb))).toBe(true)
    expect(picks.every((p) => !/colle|aquarium|adhesif/i.test(p.breadcrumb))).toBe(true)
  })

  it("rejects glue category driven only by description noise", () => {
    const ctx = buildListingProductContext(title, { description: seoDescription })
    expect(categoryOnlyMatchesDescriptionNoise(ctx, MOSQUITO_LEAVES[2]!.breadcrumb)).toBe(true)
    expect(isCategorySuggestionViable(ctx.classificationFocus, MOSQUITO_LEAVES[2]!.breadcrumb)).toBe(false)
  })

  it("AI context block forbids description-driven classification", () => {
    const ctx = buildListingProductContext(title, { description: seoDescription })
    const block = formatListingContextForAi(ctx)
    expect(block).toContain("INTERDICTIONS")
    expect(block).toContain("moustiquaire")
    expect(block).not.toContain("Bande adhésive 4cm")
  })
})
