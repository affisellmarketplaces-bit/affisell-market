import { describe, expect, it } from "vitest"

import type { LeafPath } from "@/lib/category-browse"
import {
  scoreProductTextAgainstBreadcrumb,
  suggestLeafCategoriesFromProductText,
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
})
