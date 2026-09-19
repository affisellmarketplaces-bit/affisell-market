import { describe, expect, it } from "vitest"

import { compactHighlightLabel, deriveProductHighlights, inferHighlightIcon, isShowcasePopular } from "@/lib/product-highlights"

describe("inferHighlightIcon (multilingual)", () => {
  it.each([
    ["Écran AMOLED 1.62 pouces", "screen"],
    ["Autonomie jusqu'à 14 jours", "battery"],
    ["Suivi santé 24/7 (fréquence cardiaque)", "health"],
    ["10 modes sport", "sport"],
    ["Wasserdicht bis 5 ATM", "water"],
    ["Bildschirm 1,62 Zoll", "screen"],
    ["Batería de larga duración", "battery"],
    ["防水等级 IP68", "water"],
    ["Garantie 2 ans", "warranty"],
    ["Cuir véritable", "material"],
    ["Bluetooth 5.3", "bluetooth"],
  ])("%s → %s", (text, icon) => expect(inferHighlightIcon(text)).toBe(icon))

  it("returns null when nothing matches", () => {
    expect(inferHighlightIcon("Livré avec ses accessoires")).toBeNull()
  })
})

describe("compactHighlightLabel", () => {
  it("removes bullets, emoji and markdown, and keeps the first clause", () => {
    expect(compactHighlightLabel("✅ **Écran AMOLED** ultra lumineux, 1.62 pouces")).toBe("Écran AMOLED ultra lumineux")
  })
  it("cuts long labels on a word boundary without an ellipsis", () => {
    const l = compactHighlightLabel("Batterie longue durée avec charge rapide magnétique intégrée")
    expect(l.length).toBeLessThanOrEqual(28)
    expect(l.endsWith(" ")).toBe(false)
    expect("Batterie longue durée avec charge rapide magnétique intégrée".startsWith(l)).toBe(true)
  })
  it("merges 'Label : value' and never leaves a dangling word", () => {
    expect(compactHighlightLabel("Autonomie : 14 jours")).toBe("Autonomie 14 jours")
    expect(compactHighlightLabel("Dimensions : 140 x 40 x 80 cm")).toBe("Dimensions 140 x 40 x 80 cm")
    expect(compactHighlightLabel("Matériau en bois de haute qualité résistant")).toBe("Matériau en bois")
    expect(compactHighlightLabel("Rangement optimal avec 6 tiroirs spacieux")).toBe("Rangement optimal")
  })
  it("keeps decimals intact", () => {
    expect(compactHighlightLabel("Écran 1.62 pouces")).toBe("Écran 1.62 pouces")
  })
})

describe("deriveProductHighlights", () => {
  const bullets = [
    "Écran AMOLED 1.62 pouces, ultra lumineux",
    "Suivi santé 24/7 : fréquence cardiaque, SpO2, sommeil",
    "10 modes sport professionnels",
    "Autonomie jusqu'à 14 jours",
    "Livré avec un chargeur magnétique",
  ]

  it("returns at most 4 highlights, one per icon, in bullet order", () => {
    const h = deriveProductHighlights({ bullets })
    expect(h).toHaveLength(4)
    expect(h.map((x) => x.icon)).toEqual(["screen", "health", "sport", "battery"])
    expect(new Set(h.map((x) => x.icon)).size).toBe(4)
  })

  it("prefers bullets with a recognisable topic over generic ones", () => {
    const h = deriveProductHighlights({ bullets: ["Très beau produit", "Autonomie 14 jours", "Pratique"] }, 2)
    expect(h[0]!.icon).toBe("battery")
  })

  it("falls back to spec rows when there are no bullets", () => {
    const h = deriveProductHighlights({ bullets: [], specs: [{ label: "Autonomie", value: "14 jours" }, { label: "Poids", value: "18 g" }] })
    expect(h.map((x) => x.icon)).toEqual(["battery", "weight"])
    expect(h[0]!.label).toBe("Autonomie 14 jours")
  })

  it("never duplicates and copes with empty input", () => {
    expect(deriveProductHighlights({ bullets: ["Autonomie 14 jours", "autonomie 14 jours"] })).toHaveLength(1)
    expect(deriveProductHighlights({})).toEqual([])
  })
})

describe("isShowcasePopular", () => {
  it("needs volume, a best-seller flag, or many strong reviews", () => {
    expect(isShowcasePopular({ soldCount: 17 })).toBe(false)
    expect(isShowcasePopular({ soldCount: 50 })).toBe(true)
    expect(isShowcasePopular({ isBestSeller: true })).toBe(true)
    expect(isShowcasePopular({ reviewCount: 1234, averageRating: 4.8 })).toBe(true)
    expect(isShowcasePopular({ reviewCount: 3, averageRating: 5 })).toBe(false)
    expect(isShowcasePopular({ reviewCount: 100, averageRating: 4.1 })).toBe(false)
  })
})
