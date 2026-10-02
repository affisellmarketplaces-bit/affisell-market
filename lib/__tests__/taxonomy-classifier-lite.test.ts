import { describe, expect, it, vi } from "vitest"

import { classifyProductTaxonomyLite } from "@/lib/ai/taxonomy-classifier-lite"
import { buildCategoryBrowse, type BrowseNode } from "@/lib/category-browse-shared"
import type { TaxonomyBrowse } from "@/lib/ai/taxonomy-classifier"

const row = (id: string, name: string, parentId: string | null, order: number): BrowseNode => ({ id, name, parentId, icon: "", order })

const ROWS: BrowseNode[] = [
  row("toys", "Jeux et jouets", null, 0),
  row("toys-j", "Jouets", "toys", 0),
  row("toys-p", "Poupées, coffrets et figurines", "toys-j", 0),
  row("fig", "Figurines jouets", "toys-p", 0),
  row("plush", "Peluches", "toys-p", 1),
  row("arts", "Arts et loisirs", null, 1),
  row("arts-c", "Articles de collection", "arts", 0),
  row("foot", "Articles de football dédicacés", "arts-c", 0),
  row("elec", "Appareils électroniques", null, 2),
  row("audio", "Audio", "elec", 0),
  row("ears", "Écouteurs", "audio", 0),
]

const built = buildCategoryBrowse(ROWS)
const browse = built as unknown as TaxonomyBrowse
const leafPaths = built.leafPaths

const identityPayload = {
  nameEn: "action figure",
  nameFr: "figurine articulée",
  kind: "toy",
  keywords: ["figurine", "figurines", "jouet", "action figure"],
  photoShows: "",
  photoTitleConflict: false,
  confidence: 0.9,
}

function fakeModel(handlers: { stage1?: unknown; stage2?: (candidatesText: string) => unknown }) {
  return vi.fn(async (args: { system: Array<{ text: string }>; content: Array<{ type: string; text?: string }> }) => {
    const sys = args.system.map((b) => b.text).join("\n")
    if (sys.includes("DEPARTMENTS")) return JSON.stringify(handlers.stage1)
    const candidates = args.content.map((b) => b.text ?? "").join("\n")
    return JSON.stringify(handlers.stage2?.(candidates) ?? { picks: [] })
  })
}

describe("classifyProductTaxonomyLite", () => {
  it("identifies the item, offers few candidates, and returns the chosen leaf", async () => {
    const callModel = fakeModel({
      stage1: { identity: identityPayload, departments: [{ code: "r1", confidence: 0.9 }] },
      stage2: (c) => {
        const code = /(c\d+) \| Jeux et jouets > Poupées, coffrets et figurines > Figurines jouets/.exec(c)?.[1]
        return { picks: [{ code, confidence: 0.93, reason: "toy figure" }] }
      },
    })
    const out = await classifyProductTaxonomyLite(
      { title: "Marvel Spider Man Action Figure Collectible Collection" },
      { browse, leafPaths },
      { callModel: callModel as never }
    )
    expect(out?.picks.map((p) => p.leafId)).toEqual(["fig"])
    expect(out?.picks[0]?.confidence).toBeCloseTo(0.93)
    expect(callModel).toHaveBeenCalledTimes(2)
  })

  it("stage 1 only lists the departments (not hundreds of sections) — the token budget it exists for", async () => {
    const callModel = fakeModel({ stage1: { identity: identityPayload, departments: [] } })
    await classifyProductTaxonomyLite({ title: "x figure" }, { browse, leafPaths }, { callModel: callModel as never })
    const stage1System = (callModel.mock.calls[0]![0] as { system: Array<{ text: string }> }).system.map((b) => b.text).join("\n")
    expect(stage1System).toContain("r1 | Jeux et jouets")
    expect(stage1System).toContain("r3 | Appareils électroniques")
    expect(stage1System).not.toContain("Poupées")
  })

  it("caps the candidate list and shortens deep paths (root + last two segments)", async () => {
    const callModel = fakeModel({
      stage1: { identity: identityPayload, departments: [{ code: "r1" }, { code: "r2" }, { code: "r3" }] },
      stage2: () => ({ picks: [] }),
    })
    await classifyProductTaxonomyLite({ title: "figurine" }, { browse, leafPaths }, { callModel: callModel as never })
    const stage2 = (callModel.mock.calls[1]![0] as { content: Array<{ text?: string }> }).content.map((b) => b.text ?? "").join("\n")
    const lines = stage2.split("\n").filter((l) => /^c\d+ \| /.test(l))
    expect(lines.length).toBeLessThanOrEqual(80)
    expect(stage2).toContain("Jeux et jouets > Poupées, coffrets et figurines > Figurines jouets")
  })

  it("ignores codes the model invents, and duplicates", async () => {
    const callModel = fakeModel({
      stage1: { identity: identityPayload, departments: [{ code: "r1" }, { code: "r99" }] },
      stage2: () => ({
        picks: [
          { code: "c999", confidence: 0.99, reason: "made up" },
          { code: "c1", confidence: 0.8, reason: "ok" },
          { code: "c1", confidence: 0.7, reason: "dup" },
        ],
      }),
    })
    const out = await classifyProductTaxonomyLite({ title: "figurine" }, { browse, leafPaths }, { callModel: callModel as never })
    expect(out?.picks).toHaveLength(1)
  })

  it("rescues a leaf from a department the model did not pick, using its bilingual keywords", async () => {
    const callModel = fakeModel({
      stage1: { identity: { ...identityPayload, keywords: ["écouteurs"], nameFr: "écouteurs", nameEn: "earbuds" }, departments: [{ code: "r1" }] },
      stage2: (c) => ({ picks: [{ code: /(c\d+) \| .*Écouteurs/.exec(c)?.[1], confidence: 0.9, reason: "earbuds" }] }),
    })
    const out = await classifyProductTaxonomyLite({ title: "TWS Earbuds" }, { browse, leafPaths }, { callModel: callModel as never })
    expect(out?.picks[0]?.leafId).toBe("ears")
  })

  it("returns null on an unparseable first answer, and no picks when nothing is offered", async () => {
    const bad = vi.fn(async () => "not json")
    expect(await classifyProductTaxonomyLite({ title: "x" }, { browse, leafPaths }, { callModel: bad as never })).toBeNull()

    const none = fakeModel({ stage1: { identity: { ...identityPayload, keywords: [], nameEn: "", nameFr: "", kind: "" }, departments: [] } })
    const out = await classifyProductTaxonomyLite({ title: "" }, { browse, leafPaths }, { callModel: none as never })
    expect(out?.picks).toEqual([])
  })

  it("propagates provider failures so the caller can fail over / show nothing", async () => {
    const boom = vi.fn(async () => {
      throw new Error("429 rate limit")
    })
    await expect(
      classifyProductTaxonomyLite({ title: "figurine" }, { browse, leafPaths }, { callModel: boom as never })
    ).rejects.toThrow("429")
  })
})
