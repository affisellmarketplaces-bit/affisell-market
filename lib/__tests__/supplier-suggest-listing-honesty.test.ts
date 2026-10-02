import { beforeEach, describe, expect, it, vi } from "vitest"

const { classifyWithTaxonomyAi, suggestCategoriesFromCatalog } = vi.hoisted(() => ({
  classifyWithTaxonomyAi: vi.fn(),
  suggestCategoriesFromCatalog: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/taxonomy-classify.server", () => ({ classifyWithTaxonomyAi }))
vi.mock("@/lib/category-marketplace-learning", () => ({ suggestCategoriesFromCatalog }))

import { suggestListingCategories } from "@/lib/supplier-suggest-listing"

const ROWS = [
  { id: "toys", name: "Jeux et jouets", parentId: null },
  { id: "toys-j", name: "Jouets", parentId: "toys" },
  { id: "toys-p", name: "Poupées, coffrets et figurines", parentId: "toys-j" },
  { id: "fig", name: "Figurines jouets", parentId: "toys-p" },
  { id: "arts", name: "Arts et loisirs", parentId: null },
  { id: "arts-c", name: "Articles de collection", parentId: "arts" },
  { id: "arts-s", name: "Articles de sport de collection", parentId: "arts-c" },
  { id: "foot", name: "Articles de football dédicacés", parentId: "arts-s" },
  { id: "elec", name: "Appareils électroniques", parentId: null },
  { id: "audio", name: "Audio", parentId: "elec" },
  { id: "ears", name: "Écouteurs", parentId: "audio" },
].map((r, i) => ({ ...r, icon: "", order: i }))

const client = { category: { findMany: vi.fn().mockResolvedValue(ROWS) } } as never

const SPIDERMAN =
  "Marvel Spider Man Fighting Version Articulated Action Figure Collectible For Adult Collection Home Desktop Decoration"

const identity = { nameEn: "action figure", nameFr: "figurine", kind: "toy", keywords: [], photoShows: "", photoTitleConflict: false, confidence: 0.9 }
const leaf = (leafId: string, breadcrumb: string) => ({ leafId, breadcrumb, path: [{ id: leafId, name: breadcrumb }] })

describe("suggestListingCategories — never shows a category it cannot justify", () => {
  beforeEach(() => {
    classifyWithTaxonomyAi.mockReset().mockResolvedValue(null)
    suggestCategoriesFromCatalog.mockReset().mockResolvedValue([])
    vi.spyOn(console, "log").mockImplementation(() => undefined)
  })

  it("uses the semantic engine's answer as is (Claude or Groq)", async () => {
    classifyWithTaxonomyAi.mockResolvedValue({
      engine: "groq",
      identity,
      picks: [{ ...leaf("fig", "Jeux et jouets > Jouets > Poupées, coffrets et figurines > Figurines jouets"), confidence: 0.92, reason: "toy figure" }],
    })
    const out = await suggestListingCategories(SPIDERMAN, "", client, { locale: "fr" })
    expect(out.source).toBe("ai")
    expect(out.suggestions.map((s) => s.leafId)).toEqual(["fig"])
    expect(out.recommendedLeafId).toBe("fig")
  })

  it("shows NOTHING when the AI understood the item but is unsure (no fall-through to keywords)", async () => {
    classifyWithTaxonomyAi.mockResolvedValue({
      engine: "groq",
      identity,
      picks: [{ ...leaf("foot", "Arts et loisirs > Articles de collection > Articles de sport de collection > Articles de football dédicacés"), confidence: 0.2, reason: "weak" }],
    })
    const out = await suggestListingCategories(SPIDERMAN, "", client, { locale: "fr" })
    expect(out.suggestions).toEqual([])
    expect(out.source).toBe("none")
    expect(out.recommendedLeafId).toBeNull()
  })

  it("with every AI engine down, the Spider-Man figure is NOT filed under football memorabilia", async () => {
    const out = await suggestListingCategories(SPIDERMAN, "", client, { locale: "fr" })
    const ids = out.suggestions.map((s) => s.leafId)
    expect(ids).not.toContain("foot")
    expect(ids).toContain("fig")
  })

  it("keyword-only suggestions are honest: low confidence, never recommended, never auto-applied", async () => {
    const out = await suggestListingCategories(SPIDERMAN, "", client, { locale: "fr" })
    expect(out.suggestions.length).toBeGreaterThan(0)
    for (const s of out.suggestions) {
      expect(s.suggestionSource).toBe("keyword")
      expect(s.confidence).toBeLessThanOrEqual(0.45)
    }
    expect(out.recommendedLeafId).toBeNull()
    expect(out.autoApplyRecommended).toBe(false)
  })

  it("with every AI engine down and no real product noun, returns no suggestion at all", async () => {
    const out = await suggestListingCategories("Premium Collection Decoration Gift Set New 2026", "", client, { locale: "fr" })
    expect(out.suggestions).toEqual([])
    expect(out.source).toBe("none")
  })

  it("trusts real marketplace data (catalogue learning) enough to recommend it", async () => {
    suggestCategoriesFromCatalog.mockResolvedValue([{ categoryId: "ears", breadcrumb: "x", score: 0.9, overlap: 3, sourceProductTitle: "y" }])
    const out = await suggestListingCategories("TWS Wireless Bluetooth Earbuds Noise Cancelling", "", client, { locale: "fr" })
    expect(out.source).toBe("catalog")
    expect(out.recommendedLeafId).toBe("ears")
  })
})
