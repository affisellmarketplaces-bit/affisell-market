import { describe, expect, it } from "vitest"

import {
  DESCRIPTION_BLUEPRINTS,
  pickDescriptionBlueprint,
} from "@/lib/description-blueprints"
import { parseDescriptionSections } from "@/lib/description-structure"

describe("description-blueprints", () => {
  it("picks tech blueprint for barbecue électrique", () => {
    const bp = pickDescriptionBlueprint({
      title: "Barbecue électrique NINJA Woodfire Pro Connect XL",
      categoryPath: "Maison et jardin > Cuisine > Barbecues",
      variationNonce: 0,
    })
    expect(bp.family).toBe("tech")
    expect(bp.sections.length).toBeGreaterThanOrEqual(5)
  })

  it("rotates variants within the same family", () => {
    const techBlueprints = DESCRIPTION_BLUEPRINTS.filter((b) => b.family === "tech")
    const picked = new Set(
      Array.from({ length: 12 }, (_, i) =>
        pickDescriptionBlueprint({
          title: "Robot cuisine connecté",
          categoryPath: "Électroménager",
          variationNonce: i,
        }).id
      )
    )
    expect(picked.size).toBeGreaterThan(1)
    expect(techBlueprints.some((b) => picked.has(b.id))).toBe(true)
  })

  it("parses non-classic section titles", () => {
    const text = `EN UN COUP D'ŒIL
Vue rapide du produit.

CE QUE VOUS GAGNEZ
Gain temps et confort.

SPECS QUI COMPTENT
Puissance 2400W.

MISE EN ROUTE
Branchement simple.

SCÉNARIOS D'USAGE
Grill du dimanche.`
    const sections = parseDescriptionSections(text)
    expect(sections.map((s) => s.key)).toContain("EN UN COUP D'ŒIL")
    expect(sections.length).toBeGreaterThanOrEqual(4)
  })
})
