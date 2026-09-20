import { describe, expect, it } from "vitest"

import {
  assessListingQuality,
  assessTitle,
  cleanListingTitle,
  isFormulaResiduePrice,
  psychologicalPriceCents,
} from "@/lib/listing-quality"

describe("cleanListingTitle — real supplier titles", () => {
  it.each([
    ["Meuble de rangement Commode 6 tiroirs en bois blanc - Rangement optimal", "Meuble de rangement Commode 6 tiroirs en bois blanc"],
    ["Montre Connectée Xiaomi Smart Band 10 : Suivi d'Activité, Écran AMOLED, Autonomie Longue, Charge Rapide pour iOS et Android", "Montre Connectée Xiaomi Smart Band 10"],
    ["【Demo Lab】 Aurora Wireless Earbuds", "Aurora Wireless Earbuds"],
    ["ACEMAGIC AX17 Pro : Ordinateur portable Ryzen 3, 17,3 pouces, 16 Go RAM, 512 Go SSD", "ACEMAGIC AX17 Pro – Ordinateur portable Ryzen 3"],
    ["🔥 Hot Sale ✔ Wireless Earbuds Bluetooth 5.3 ✔ 2024 New", "Hot Sale Wireless Earbuds Bluetooth 5.3 2024 New"],
  ])("%s", (raw, expected) => {
    expect(cleanListingTitle(raw)).toBe(expected)
  })

  it("cuts a long sentence-like title at a word boundary, never on a dangling word", () => {
    const out = cleanListingTitle("Stabilisateur de téléphone intelligent avec suivi du visage et lumière de remplissage pour des vidéos fluides")
    expect(out.length).toBeLessThanOrEqual(80)
    expect(out).not.toMatch(/\b(avec|pour|et|de|des|du)$/i)
    expect(out.startsWith("Stabilisateur de téléphone intelligent")).toBe(true)
  })

  it("un-shouts ALL CAPS but keeps short codes and models", () => {
    expect(cleanListingTitle("BLUETOOTH WIRELESS HEADPHONES NOISE CANCELLING WH-1000XM5")).toBe("Bluetooth wireless headphones noise cancelling WH-1000XM5")
  })

  it("leaves a good short title untouched and never returns an empty string", () => {
    expect(cleanListingTitle("Casque Sony WH-1000XM5")).toBe("Casque Sony WH-1000XM5")
    expect(cleanListingTitle("✔✔✔")).not.toBe("")
    expect(cleanListingTitle("")).toBe("")
  })
})

describe("assessTitle", () => {
  it("flags stuffing, decorations and length", () => {
    expect(assessTitle("Casque, Bluetooth, Sans fil, Réduction de bruit, Autonomie longue").issues).toContain("keyword_stuffing")
    expect(assessTitle("🔥 Casque Bluetooth").issues).toContain("decorations")
    expect(assessTitle("x".repeat(90)).issues).toContain("too_long")
    expect(assessTitle("Casque Sony WH-1000XM5").ok).toBe(true)
  })
})

describe("psychological pricing", () => {
  it("moves a formula residue to a deliberate price without distorting it", () => {
    for (const c of [4123, 2244, 8506, 41234]) {
      const p = psychologicalPriceCents(c)
      expect(isFormulaResiduePrice(p)).toBe(false)
      expect(Math.abs(p - c)).toBeLessThanOrEqual(c * 0.035 + 1)
    }
    expect(psychologicalPriceCents(4123)).toBe(4099)
    expect(psychologicalPriceCents(1999)).toBe(1999)
    expect(psychologicalPriceCents(150)).toBe(150)
  })
  it("recognises formula residues", () => {
    expect(isFormulaResiduePrice(41234)).toBe(true)
    expect(isFormulaResiduePrice(2990)).toBe(false)
  })
})

describe("assessListingQuality", () => {
  it("rewards a complete, honest listing and flags a raw import", () => {
    const raw = assessListingQuality({ title: "🔥 HOT SALE ✔ Casque, Bluetooth, Sans fil, Réduction de bruit", imageCount: 1, priceCents: 4123 })
    expect(raw.tier).toBe("needs_work")
    const good = assessListingQuality({
      title: "Casque Sony WH-1000XM5",
      description: "x".repeat(200),
      imageCount: 5,
      priceCents: 34990,
      brand: "Sony",
      hasWarranty: true,
      shipsFromCountry: "FR",
      hasDeliveryProfile: true,
    })
    expect(good.score).toBe(100)
    expect(good.tier).toBe("excellent")
  })
})

describe("cleanListingTitle — light mode (reseller's own wording)", () => {
  it("strips noise but never shortens", () => {
    const long = "Trottinette électrique tout-terrain BMERY 10 pouces, puissance 1000W, 40km/h, 30-40km de portée"
    expect(cleanListingTitle(long, { light: true })).toBe(long)
    expect(cleanListingTitle("🔥 Trottinette BMERY ✔", { light: true })).toBe("Trottinette BMERY")
  })
})

describe("assessListingQuality — without a buyer price (supplier wholesale form)", () => {
  it("skips the price check and renormalises to 0–100", () => {
    const r = assessListingQuality({
      title: "Casque Sony WH-1000XM5",
      description: "x".repeat(200),
      imageCount: 5,
      brand: "Sony",
      hasWarranty: true,
      shipsFromCountry: "FR",
      hasDeliveryProfile: true,
    })
    expect(r.checks.some((c) => c.id === "price")).toBe(false)
    expect(r.score).toBe(100)
    const half = assessListingQuality({ title: "Casque Sony WH-1000XM5", description: "x".repeat(200), imageCount: 5 })
    expect(half.score).toBeGreaterThan(0)
    expect(half.score).toBeLessThan(100)
  })
})
