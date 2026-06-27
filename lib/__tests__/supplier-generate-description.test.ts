import { describe, expect, it } from "vitest"

import {
  buildDescriptionGenerationPrompt,
  extractProductSpecsFromNotes,
  hasStructuredDescriptionSections,
  isRawProductFeatureDump,
  isSpecSheetDraftNotes,
  pickGalleryIllustrations,
  sanitizeDraftNotesForGeneration,
  shouldUseVisionForDescription,
} from "@/lib/supplier-generate-description"

describe("supplier-generate-description", () => {
  it("detects raw comma-separated title dumps", () => {
    const dump =
      "Téléphones mobiles 17 Pro Max neufs, 7,3 pouces, smartphone 5G, version mondiale Android, 7800 mAh, GPS, Wifi, double SIM"
    expect(isRawProductFeatureDump(dump, "17 Pro Max 5G")).toBe(true)
    expect(sanitizeDraftNotesForGeneration(dump, "17 Pro Max 5G")).toBe("")
  })

  it("keeps AliExpress-style spec sheets in draft notes", () => {
    const sheet = `Sac fourre-tout classique uni pour femme

Lieu d'origine
Province du GUANG DONG

Matériau de doublure
POLYESTER

Type de sacs à main
Cabas`
    expect(isSpecSheetDraftNotes(sheet)).toBe(true)
    expect(sanitizeDraftNotesForGeneration(sheet, "Sac fourre-tout")).toContain("POLYESTER")
    const specs = extractProductSpecsFromNotes(sheet)
    expect(specs.some((s) => s.label.toLowerCase().includes("matériau"))).toBe(true)
    expect(specs.some((s) => s.value === "POLYESTER")).toBe(true)
  })

  it("builds title-first prompt with specs and category as tone only", () => {
    const { system, user, blueprint } = buildDescriptionGenerationPrompt({
      title: "Téléphone portable 17 Pro Max 5G, 7.3 pouces",
      productName: "telephone portable pro max",
      categoryPath: "Appareils électroniques > Communications > Téléphones mobiles",
      specs: [{ label: "Brand name", value: "Generic" }, { label: "Taille", value: "7.3 pouces" }],
      bullets: ["Double SIM", "7800 mAh"],
      draftNotes: "",
      galleryCount: 2,
      variationNonce: 1,
    })
    expect(system).toContain("TITRE")
    expect(system).toContain("Varie le vocabulaire")
    expect(user).toContain("17 Pro Max")
    expect(user).toContain("Brand name")
    expect(user).toContain("Contexte rayon")
    expect(user).toContain("Plan éditorial")
    expect(blueprint.family).toBe("tech")
    expect(blueprint.sections.length).toBeGreaterThanOrEqual(5)
  })

  it("recognizes structured SEO sections", () => {
    const structured = `ACCROCHE
Un smartphone pensé pour la productivité mobile.

POUR QUI ?
Utilisateurs exigeants qui veulent un grand écran.

POINTS FORTS
Écran 7,3 pouces, double SIM, batterie 7800 mAh.

UTILISATION & ENTRETIEN
Utilisation quotidienne, charge USB-C 20W.

POURQUOI CE PRODUIT ?
Rapport écran/autonomie optimisé.

INNOVATION
Format XL avec Android 15.`
    expect(hasStructuredDescriptionSections(structured)).toBe(true)
  })

  it("picks gallery images by index", () => {
    const dataUrls = ["data:image/jpeg;base64,aaa", "data:image/jpeg;base64,bbb"]
    const urls = ["https://cdn.example/a.jpg"]
    const out = pickGalleryIllustrations(urls, dataUrls, [0, 2])
    expect(out).toEqual(["data:image/jpeg;base64,aaa", "https://cdn.example/a.jpg"])
  })

  it("skips vision when product facts are already in text/specs", () => {
    expect(
      shouldUseVisionForDescription({
        specs: [{ label: "Matériau", value: "POLYESTER" }],
        draftNotes: "",
        bullets: [],
        title: "Sac fourre-tout",
        visionImageCount: 3,
      })
    ).toBe(false)
    expect(
      shouldUseVisionForDescription({
        specs: [],
        draftNotes: "",
        bullets: [],
        title: "Produit",
        visionImageCount: 2,
      })
    ).toBe(true)
  })
})
