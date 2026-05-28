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
    breadcrumb:
      "Appareils électroniques > Communications > Téléphonie > Téléphones mobiles",
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
  {
    leafId: "fan-portable",
    breadcrumb:
      "Maison et jardin > Appareils électroménagers > Chauffage et climatisation > Ventilateurs > Ventilateurs portatifs et brumisateurs",
    path: [],
  },
  {
    leafId: "security-lamp",
    breadcrumb:
      "Maison et jardin > Sécurité à domicile et au bureau > Lampes de sécurité",
    path: [],
  },
  {
    leafId: "surveillance",
    breadcrumb:
      "Maison et jardin > Sécurité à domicile et au bureau > Systèmes de surveillance et d'enregistrement",
    path: [],
  },
  {
    leafId: "bike-shifter",
    breadcrumb:
      "Équipements sportifs > Loisirs de plein air > Cyclisme > Pièces détachées vélo > Pièces de transmission de vélo > Leviers de vitesses de vélo",
    path: [],
  },
  {
    leafId: "stop-trottoir",
    breadcrumb:
      "Entreprise et industrie > Signalétique > Chevalets stop-trottoir et enseignes publicitaires de jardin",
    path: [],
  },
  {
    leafId: "scooter-leaf",
    breadcrumb: "Équipements sportifs > Loisirs de plein air > Trottinettes",
    path: [],
  },
  {
    leafId: "phone-jammer",
    breadcrumb:
      "Appareils électroniques > Accessoires électroniques > Brouilleurs de signal > Brouilleurs de téléphone mobile",
    path: [],
  },
  {
    leafId: "leggings-collants",
    breadcrumb: "Vêtements et accessoires > Vêtements > Sous-vêtements et chaussettes > Collants",
    path: [],
  },
  {
    leafId: "football-pants",
    breadcrumb:
      "Vêtements et accessoires > Vêtements > Vêtements fitness et sports > Pantalons de football américain",
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

  it("matches French singular title to plural taxonomy tokens (ventilateur → ventilateurs)", () => {
    expect(
      wordMatchesInBreadcrumb(
        "ventilateur",
        FIXTURE_LEAVES.find((l) => l.leafId === "fan-portable")!.breadcrumb
      )
    ).toBe(true)
  })

  it("ranks portable fans above security and bike parts for ventilateur title", () => {
    const title =
      "Jsdoin Ventilateur portable rechargeable avec Lumière et Power Bank 10000mAh"
    const picks = suggestLeafCategoriesFromProductText(title, "", FIXTURE_LEAVES, 3)

    expect(picks.length).toBeGreaterThan(0)
    expect(picks[0]?.leafId).toBe("fan-portable")
    expect(picks.some((p) => p.leafId === "bike-shifter")).toBe(false)
    expect(picks.some((p) => p.leafId === "security-lamp")).toBe(false)
    expect(picks.some((p) => p.leafId === "surveillance")).toBe(false)
  })

  it("ranks mobile phones above signal jammers for téléphones mobiles title", () => {
    const title = "Téléphones mobiles 17 Pro Max neufs, 7,3 pouces"
    const phoneScore = scoreProductTextAgainstBreadcrumb(
      title,
      FIXTURE_LEAVES.find((l) => l.leafId === "phone")!.breadcrumb
    )
    const jammerScore = scoreProductTextAgainstBreadcrumb(
      title,
      FIXTURE_LEAVES.find((l) => l.leafId === "phone-jammer")!.breadcrumb
    )

    expect(phoneScore).toBeGreaterThan(jammerScore)
    const picks = suggestLeafCategoriesFromProductText(title, "", FIXTURE_LEAVES, 3)
    expect(picks[0]?.leafId).toBe("phone")
    expect(picks.some((p) => p.leafId === "phone-jammer")).toBe(false)
  })

  it("ranks collants above american football pants for leggings title", () => {
    const title = "Leonie Leggings Anti Cellulite 3D Femme Original"
    const collantsScore = scoreProductTextAgainstBreadcrumb(
      title,
      FIXTURE_LEAVES.find((l) => l.leafId === "leggings-collants")!.breadcrumb
    )
    const footballScore = scoreProductTextAgainstBreadcrumb(
      title,
      FIXTURE_LEAVES.find((l) => l.leafId === "football-pants")!.breadcrumb
    )

    expect(collantsScore).toBeGreaterThan(footballScore)
    const picks = suggestLeafCategoriesFromProductText(title, "", FIXTURE_LEAVES, 3)
    expect(picks[0]?.leafId).toBe("leggings-collants")
  })

  it("ranks trottinettes above stop-trottoir signage for electric scooter title", () => {
    const title =
      "Scooter-Trottinette électrique tout-terrain pour adultes, trottinette électrique, 1000W"
    const stopScore = scoreProductTextAgainstBreadcrumb(
      title,
      FIXTURE_LEAVES.find((l) => l.leafId === "stop-trottoir")!.breadcrumb
    )
    const scooterScore = scoreProductTextAgainstBreadcrumb(
      title,
      FIXTURE_LEAVES.find((l) => l.leafId === "scooter-leaf")!.breadcrumb
    )

    expect(scooterScore).toBeGreaterThan(stopScore)
    const picks = suggestLeafCategoriesFromProductText(title, "", FIXTURE_LEAVES, 3)
    expect(picks[0]?.leafId).toBe("scooter-leaf")
    expect(picks.some((p) => p.leafId === "stop-trottoir")).toBe(false)
  })
})
