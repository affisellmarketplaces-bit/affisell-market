import { describe, expect, it } from "vitest"

import type { LeafPath } from "@/lib/category-browse"
import {
  findWearableCategoryAlternatives,
  isCategorySuggestionViable,
  scoreProductTextAgainstBreadcrumb,
  suggestLeafCategoriesFromProductText,
  wordMatchesInBreadcrumb,
} from "@/lib/category-title-match"

const FIXTURE_LEAVES: LeafPath[] = [
  {
    leafId: "activity",
    breadcrumb: "Santé et beauté > Santé > Moniteurs biométriques > Moniteurs d'activité",
    path: [],
  },
  {
    leafId: "connectors",
    breadcrumb:
      "Appareils électroniques > Composants > Connecteurs de composants électroniques",
    path: [],
  },
  {
    leafId: "io-backplate",
    breadcrumb:
      "Appareils électroniques > Accessoires électroniques > Composants d'ordinateur > Plaques arrière et connecteurs d'entrée-sortie",
    path: [],
  },
  {
    leafId: "white-noise",
    breadcrumb:
      "Santé et beauté > Hygiène personnelle > Aides au sommeil > Générateurs de bruit blanc",
    path: [],
  },
  {
    leafId: "phone",
    breadcrumb: "Appareils électroniques > Communications > Téléphones mobiles",
    path: [],
  },
  {
    leafId: "watches-jewelry",
    breadcrumb: "Vêtements et accessoires > Bijoux > Montres",
    path: [],
  },
  {
    leafId: "backup-cam",
    breadcrumb:
      "Véhicules et accessoires > Pièces détachées pour véhicules > Électronique pour véhicules > Caméras de recul",
    path: [],
  },
  {
    leafId: "pet-grid",
    breadcrumb:
      "Animaux et articles pour animaux de compagnie > Articles pour animaux de compagnie > Grille de séparation de voiture pour animaux",
    path: [],
  },
  {
    leafId: "car-guide",
    breadcrumb: "Médias > Guides d'utilisation > Guides d'utilisation de voitures",
    path: [],
  },
  {
    leafId: "carport",
    breadcrumb:
      "Maison et jardin > Pelouses et jardins > Vie en extérieur > Structures extérieures > Cabanes, garages et auvents pour voitures",
    path: [],
  },
  {
    leafId: "sim-prepaid",
    breadcrumb:
      "Appareils électroniques > Communications > Téléphonie > Accessoires pour téléphones mobiles > Cartes prépayées et cartes SIM pour téléphones mobiles > Cartes prépayées pour téléphone portable",
    path: [],
  },
  {
    leafId: "carplay-headunit",
    breadcrumb:
      "Véhicules et accessoires > Pièces détachées pour véhicules > Électronique pour véhicules > Lecteurs et systèmes audio et vidéo intégrés pour véhicules",
    path: [],
  },
  {
    leafId: "handsfree",
    breadcrumb:
      "Véhicules et accessoires > Pièces détachées pour véhicules > Électronique pour véhicules > Kits mains-libres pour véhicules",
    path: [],
  },
]

describe("category-title-match", () => {
  it("ranks activity monitors above connectors for a smart band title", () => {
    const title = "Xiaomi Smart Band 10, Montre Connectée"
    const description = "Suivi du sommeil amélioré, écran AMOLED 1.72 pouces, autonomie 21 jours"

    const activity = scoreProductTextAgainstBreadcrumb(
      `${title} ${description}`,
      FIXTURE_LEAVES[0]!.breadcrumb
    )
    const connectors = scoreProductTextAgainstBreadcrumb(
      `${title} ${description}`,
      FIXTURE_LEAVES[1]!.breadcrumb
    )
    const whiteNoise = scoreProductTextAgainstBreadcrumb(
      `${title} ${description}`,
      FIXTURE_LEAVES[3]!.breadcrumb
    )

    expect(activity).toBeGreaterThan(connectors)
    expect(activity).toBeGreaterThan(whiteNoise)
  })

  it("suggests only relevant leaves for wearables (no connector filler)", () => {
    const picks = suggestLeafCategoriesFromProductText(
      "Xiaomi Smart Band 10, Montre Connec",
      "Bracelet connecté avec suivi du sommeil",
      FIXTURE_LEAVES,
      3
    )

    expect(picks.length).toBeGreaterThan(0)
    expect(picks[0]?.leafId).toBe("activity")
    expect(picks.some((p) => p.leafId === "connectors")).toBe(false)
    expect(picks.some((p) => p.leafId === "white-noise")).toBe(false)
  })

  it("returns empty when title is too vague", () => {
    const picks = suggestLeafCategoriesFromProductText("Pro Max", "", FIXTURE_LEAVES, 3)
    expect(picks).toEqual([])
  })

  it("ranks vehicle backup cameras above pet car accessories for dashcam title", () => {
    const title = "Caméra de voiture REDTIGER F17 3 canaux 4K"
    const picks = suggestLeafCategoriesFromProductText(title, "", FIXTURE_LEAVES, 3)

    expect(picks.length).toBeGreaterThan(0)
    expect(picks[0]?.leafId).toBe("backup-cam")
    expect(picks.some((p) => p.leafId === "pet-grid")).toBe(false)
    expect(picks.some((p) => p.leafId === "car-guide")).toBe(false)
  })

  it("does not match car inside carte (substring trap)", () => {
    expect(
      wordMatchesInBreadcrumb(
        "car",
        FIXTURE_LEAVES.find((l) => l.leafId === "sim-prepaid")!.breadcrumb
      )
    ).toBe(false)
    expect(
      wordMatchesInBreadcrumb(
        "car",
        FIXTURE_LEAVES.find((l) => l.leafId === "carplay-headunit")!.breadcrumb
      )
    ).toBe(false)
  })

  it("ranks CarPlay adapters above prepaid SIM leaves", () => {
    const title = "Adaptateur CarPlay sans Fil pour Apple et Android"
    const description =
      "Module multimédia auto, écran tactile, compatible iOS 10+ et Android 10+, installation voiture"

    const simScore = scoreProductTextAgainstBreadcrumb(
      `${title} ${description}`,
      FIXTURE_LEAVES.find((l) => l.leafId === "sim-prepaid")!.breadcrumb
    )
    const headunitScore = scoreProductTextAgainstBreadcrumb(
      `${title} ${description}`,
      FIXTURE_LEAVES.find((l) => l.leafId === "carplay-headunit")!.breadcrumb
    )

    expect(headunitScore).toBeGreaterThan(simScore)
    expect(isCategorySuggestionViable(`${title} ${description}`, FIXTURE_LEAVES.find((l) => l.leafId === "sim-prepaid")!.breadcrumb)).toBe(
      false
    )

    const picks = suggestLeafCategoriesFromProductText(title, description, FIXTURE_LEAVES, 3)
    expect(picks.length).toBeGreaterThan(0)
    expect(picks[0]?.leafId).toBe("carplay-headunit")
    expect(picks.some((p) => p.leafId === "sim-prepaid")).toBe(false)
  })

  it("offers jewelry watches as alternative for smart band primary", () => {
    const title = "Xiaomi Smart Band 10, Montre Connectée"
    const primary = suggestLeafCategoriesFromProductText(title, "", FIXTURE_LEAVES, 3)
    const alts = findWearableCategoryAlternatives(title, "", FIXTURE_LEAVES, primary)

    expect(primary[0]?.leafId).toBe("activity")
    expect(alts).toHaveLength(1)
    expect(alts[0]?.leafId).toBe("watches-jewelry")
    expect(alts[0]?.reason).toMatch(/déconseillé/i)
  })
})
