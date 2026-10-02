import { describe, expect, it } from "vitest"

import {
  categoryHasSpecificEvidence,
  expandEnglishProductTerms,
  filterByKeywordEvidence,
  specificTitleTokens,
} from "@/lib/category-keyword-evidence"

// Real labels of the Affisell (Google-derived, French) taxonomy.
const FOOTBALL =
  "Arts et loisirs > Loisirs et arts créatifs > Articles de collection > Articles de sport de collection > Articles de sport dédicacés > Articles de football dédicacés"
const FIGURINES = "Jeux et jouets > Jouets > Poupées, coffrets et figurines > Figurines jouets"
const DECO_FIGURINES = "Maison et jardin > Décorations > Figurines"
const EARBUDS = "Appareils électroniques > Audio > Composants audio > Casques Audio & Écouteurs > Écouteurs"
const SMARTWATCH = "Appareils électroniques > Objets connectés et réalité virtuelle > Montres connectées"

const SPIDERMAN =
  "Marvel Spider Man Fighting Version Articulated Action Figure Collectible For Adult Collection Home Desktop Decoration"

describe("keyword evidence — the Spider-Man regression", () => {
  it("rejects the football-memorabilia category the keyword scorer used to pick", () => {
    expect(categoryHasSpecificEvidence(SPIDERMAN, FOOTBALL)).toBe(false)
  })

  it("accepts the figurine categories once English product nouns are understood", () => {
    expect(categoryHasSpecificEvidence(SPIDERMAN, FIGURINES)).toBe(true)
    expect(categoryHasSpecificEvidence(SPIDERMAN, DECO_FIGURINES)).toBe(true)
  })

  it("keeps only the leaves backed by evidence", () => {
    const kept = filterByKeywordEvidence(SPIDERMAN, [{ breadcrumb: FOOTBALL }, { breadcrumb: FIGURINES }])
    expect(kept.map((k) => k.breadcrumb)).toEqual([FIGURINES])
  })
})

describe("generic words never count as evidence", () => {
  it("ignores marketing / audience filler", () => {
    expect(specificTitleTokens("Premium Collection Adult Home Desktop Decoration Gift Set 2026")).toEqual([])
    expect(
      categoryHasSpecificEvidence("Collection Collectible Adult Decoration", "Arts et loisirs > Articles de collection")
    ).toBe(false)
  })

  it("does not let an ancestor segment vouch for the leaf", () => {
    // "football" appears only in the leaf; "collection" only in ancestors (and is generic anyway).
    expect(categoryHasSpecificEvidence("Ballon de football officiel", FOOTBALL)).toBe(true)
    expect(categoryHasSpecificEvidence("Collection de tasses", FOOTBALL)).toBe(false)
  })

  it("does not match by prefix (articulated ≠ articles, collectible ≠ collection)", () => {
    expect(categoryHasSpecificEvidence("Articulated robot", "Maison > Articles de cuisine")).toBe(false)
  })
})

describe("English → French product nouns", () => {
  it("expands recognised nouns and leaves the original text intact", () => {
    const out = expandEnglishProductTerms("Wireless Bluetooth Earbuds Pro")
    expect(out.startsWith("Wireless Bluetooth Earbuds Pro")).toBe(true)
    expect(out).toContain("ecouteurs")
  })

  it("finds the right leaf for common AliExpress-style titles", () => {
    expect(categoryHasSpecificEvidence("TWS Wireless Bluetooth Earbuds Noise Cancelling", EARBUDS)).toBe(true)
    expect(categoryHasSpecificEvidence("Smart Watch Men Fitness Tracker Waterproof", SMARTWATCH)).toBe(true)
    expect(categoryHasSpecificEvidence("Smart Watch Men Fitness Tracker Waterproof", FOOTBALL)).toBe(false)
  })

  it("works for French titles without translation (plural/singular insensitive)", () => {
    expect(categoryHasSpecificEvidence("Montre connectée sport étanche", SMARTWATCH)).toBe(true)
    expect(categoryHasSpecificEvidence("Écouteur sans fil", EARBUDS)).toBe(true)
  })

  it("returns no evidence for an empty or meaningless title", () => {
    expect(categoryHasSpecificEvidence("", FIGURINES)).toBe(false)
    expect(categoryHasSpecificEvidence("New Hot Sale", FIGURINES)).toBe(false)
  })
})
