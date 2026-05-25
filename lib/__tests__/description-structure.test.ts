import { describe, expect, it } from "vitest"

import { parseDescriptionSections } from "@/lib/description-structure"

describe("parseDescriptionSections", () => {
  it("splits SEO blocks", () => {
    const text = `ACCROCHE
Hook line.

POUR QUI ?
Buyers.

POINTS FORTS
Feature one.`
    const sections = parseDescriptionSections(text)
    expect(sections.map((s) => s.key)).toEqual(["ACCROCHE", "POUR QUI ?", "POINTS FORTS"])
    expect(sections[1]?.body).toContain("Buyers")
  })
})
