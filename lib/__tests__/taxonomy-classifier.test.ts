import { describe, expect, it, vi } from "vitest"

import {
  buildSections,
  classifyProductTaxonomy,
  globalLexicalCandidates,
  normalizeIdentity,
  sectionsPromptBlock,
  trimCandidates,
  type TaxonomyBrowse,
} from "@/lib/ai/taxonomy-classifier"
import { parseJsonObject } from "@/lib/ai/anthropic-messages"
import { buildCategoryBrowse } from "@/lib/category-browse-shared"

const ROWS = [
  { id: "veh", name: "Véhicules", parentId: null, icon: null, order: 0 },
  { id: "veh-parts", name: "Pièces", parentId: "veh", icon: null, order: 0 },
  { id: "veh-diag", name: "Systèmes de diagnostic automobile", parentId: "veh-parts", icon: null, order: 0 },
  { id: "veh-batt", name: "Testeurs de batteries", parentId: "veh-parts", icon: null, order: 1 },
  { id: "elec", name: "Électronique", parentId: null, icon: null, order: 1 },
  { id: "elec-audio", name: "Audio", parentId: "elec", icon: null, order: 0 },
  { id: "elec-earbuds", name: "Écouteurs", parentId: "elec-audio", icon: null, order: 0 },
  { id: "solo", name: "Divers", parentId: null, icon: null, order: 2 },
]

const browse = buildCategoryBrowse(ROWS) as unknown as TaxonomyBrowse & { leafPaths: ReturnType<typeof buildCategoryBrowse>["leafPaths"] }

describe("taxonomy sections", () => {
  it("lists level-2 sections with their leaf counts, and roots without children as their own section", () => {
    const { sections, leavesBySection } = buildSections(browse)
    expect(sections.map((s) => s.label)).toEqual(["Véhicules > Pièces", "Électronique > Audio", "Divers"])
    expect(sections.map((s) => s.leafCount)).toEqual([2, 1, 1])
    expect(leavesBySection.get("s1")).toEqual(["veh-diag", "veh-batt"])
    expect(sectionsPromptBlock(sections)).toContain("s2 | Électronique > Audio (1)")
  })
})

describe("candidate trimming", () => {
  it("keeps everything when small, and the most relevant leaves when large", () => {
    const leafById = new Map(browse.leafPaths.map((lp) => [lp.leafId, lp]))
    const identity = normalizeIdentity({ nameEn: "car diagnostic scanner", keywords: ["diagnostic", "automobile"] }, "x")
    expect(trimCandidates(["veh-diag", "veh-batt"], leafById, identity, 5)).toEqual(["veh-diag", "veh-batt"])
    expect(trimCandidates(["veh-batt", "veh-diag", "elec-earbuds"], leafById, identity, 1)).toEqual(["veh-diag"])
  })
})

describe("global lexical rescue", () => {
  it("offers leaves from sections the model did not pick, ranked by product-type overlap", () => {
    const identity = normalizeIdentity({ nameEn: "earbuds", nameFr: "écouteurs sans fil", keywords: ["écouteurs"] }, "x")
    expect(globalLexicalCandidates(browse.leafPaths, identity, "Air Pro 2026")).toEqual(["elec-earbuds"])
    expect(globalLexicalCandidates(browse.leafPaths, normalizeIdentity({}, ""), "")).toEqual([])
  })
})

describe("json extraction", () => {
  it("tolerates fences and chatter", () => {
    expect(parseJsonObject('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJsonObject("no json")).toBeNull()
  })
})

describe("classifyProductTaxonomy (model mocked)", () => {
  it("identifies, descends and returns the picked leaves ranked by confidence, ignoring unknown codes", async () => {
    const callModel = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          identity: { nameEn: "OBD scanner", nameFr: "scanner OBD", kind: "tool", keywords: ["obd", "diagnostic"], photoShows: "red handheld scanner", photoTitleConflict: true, confidence: 0.9 },
          sections: [{ code: "s1", confidence: 0.9 }, { code: "s99", confidence: 0.5 }],
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          picks: [
            { code: "c2", confidence: 0.3, reason: "battery tester" },
            { code: "c1", confidence: 0.95, reason: "car diagnostic" },
            { code: "c77", confidence: 0.9, reason: "unknown code" },
          ],
        })
      )
    const r = await classifyProductTaxonomy(
      { title: "Nouveau produit 2026", imageUrl: "https://cdn.example.com/obd.jpg" },
      { browse, leafPaths: browse.leafPaths },
      { callModel }
    )
    expect(r?.identity.photoTitleConflict).toBe(true)
    expect(r?.picks.map((p) => [p.leafId, p.confidence])).toEqual([["veh-diag", 0.95], ["veh-batt", 0.3]])
    // the photo is sent to both steps
    const firstContent = callModel.mock.calls[0]![0].content as Array<{ type: string }>
    expect(firstContent[0]!.type).toBe("image")
  })

  it("returns no picks (not an error) when no known section is chosen", async () => {
    const callModel = vi.fn().mockResolvedValueOnce(JSON.stringify({ identity: {}, sections: [] }))
    const r = await classifyProductTaxonomy({ title: "???" }, { browse, leafPaths: browse.leafPaths }, { callModel })
    expect(r?.picks).toEqual([])
    expect(callModel).toHaveBeenCalledTimes(1)
  })

  it("returns null on unparseable model output", async () => {
    const callModel = vi.fn().mockResolvedValueOnce("sorry")
    expect(await classifyProductTaxonomy({ title: "x" }, { browse, leafPaths: browse.leafPaths }, { callModel })).toBeNull()
  })
})
