import { describe, expect, it } from "vitest"

import {
  buildDescriptionGenerationPrompt,
  hasStructuredDescriptionSections,
  isRawProductFeatureDump,
  pickGalleryIllustrations,
  sanitizeDraftNotesForGeneration,
} from "@/lib/supplier-generate-description"

describe("supplier-generate-description", () => {
  it("detects raw comma-separated title dumps", () => {
    const dump =
      "Téléphones mobiles 17 Pro Max neufs, 7,3 pouces, smartphone 5G, version mondiale Android, 7800 mAh, GPS, Wifi, double SIM"
    expect(isRawProductFeatureDump(dump, "17 Pro Max 5G")).toBe(true)
    expect(sanitizeDraftNotesForGeneration(dump, "17 Pro Max 5G")).toBe("")
  })

  it("builds title-first prompt with specs and category as tone only", () => {
    const { system, user } = buildDescriptionGenerationPrompt({
      title: "Téléphone portable 17 Pro Max 5G, 7.3 pouces",
      productName: "telephone portable pro max",
      categoryPath: "Appareils électroniques > Communications > Téléphones mobiles",
      specs: [{ label: "Brand name", value: "Generic" }, { label: "Taille", value: "7.3 pouces" }],
      bullets: ["Double SIM", "7800 mAh"],
      draftNotes: "",
      galleryCount: 2,
    })
    expect(system).toContain("TITRE")
    expect(user).toContain("17 Pro Max")
    expect(user).toContain("Brand name")
    expect(user).toContain("Contexte rayon")
    expect(user).toContain("ACCROCHE")
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
})
