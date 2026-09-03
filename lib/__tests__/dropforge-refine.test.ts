import { describe, expect, it } from "vitest"

import { auditDropForgePreview, dropForgeRefineQuickPrompt } from "@/lib/dropforge-refine-audit"
import { applyDropForgeRefinePatch } from "@/lib/dropforge-refine-patch"

describe("dropforge-refine-audit", () => {
  it("flags blockers on empty shell", () => {
    const gaps = auditDropForgePreview({ title: "", images: [], costPrice: 0 })
    const ids = gaps.map((g) => g.id)
    expect(ids).toContain("title")
    expect(ids).toContain("images")
    expect(ids).toContain("cost")
  })

  it("builds quick prompts in French", () => {
    expect(dropForgeRefineQuickPrompt("images", "fr")).toMatch(/galerie/i)
  })
})

describe("applyDropForgeRefinePatch", () => {
  it("merges images and specs without duplicating", () => {
    const base = {
      title: "Chaussure",
      description: "Desc courte",
      images: ["https://cdn.example/a.jpg"],
      costPrice: 29.99,
      specs: { Matière: "Cuir" },
    }
    const { preview, applied } = applyDropForgeRefinePatch(base, {
      addImages: ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"],
      addSpecs: { Matière: "ignore", Semelle: "EVA" },
      description: "Description longue et complète pour le catalogue wholesale Affisell avec détails produit.",
    })
    expect(applied).toContain("addImages")
    expect(applied).toContain("specs")
    expect(preview.images).toHaveLength(2)
    expect(preview.specs.Semelle).toBe("EVA")
    expect(preview.specs.Matière).toBe("Cuir")
  })
})
