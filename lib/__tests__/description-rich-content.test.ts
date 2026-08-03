import { describe, expect, it } from "vitest"

import {
  descriptionHasImageMarkers,
  insertImageMarkerAt,
  parseDescriptionRichContent,
  reindexDescriptionAfterImageRemoval,
  stripDescriptionImageMarkers,
  stripStandaloneImageMarkerLines,
  unreferencedIllustrationImages,
} from "@/lib/description-rich-content"

describe("description-rich-content", () => {
  it("parses interleaved text and image markers", () => {
    const images = ["https://cdn/a.jpg", "https://cdn/b.jpg"]
    const text = "Intro\n\n[[img:0]]\n\nSuite\n\n[[img:1]]\n\nFin"
    const parts = parseDescriptionRichContent(text, images)
    expect(parts).toHaveLength(5)
    expect(parts[0]).toEqual({ kind: "text", text: "Intro\n\n" })
    expect(parts[1]).toEqual({ kind: "image", index: 0, src: images[0] })
    expect(parts[3]).toEqual({ kind: "image", index: 1, src: images[1] })
  })

  it("parses markers with spaces and never leaves raw tags in strip", () => {
    const text = "A\n\n[[ img:0 ]]\n\nB\n[[img:1]]"
    expect(descriptionHasImageMarkers(text)).toBe(true)
    const parts = parseDescriptionRichContent(text, ["https://a", "https://b"])
    expect(parts.some((p) => p.kind === "image" && p.index === 0)).toBe(true)
    expect(stripDescriptionImageMarkers(text)).toBe("A\n\nB")
    expect(stripDescriptionImageMarkers(text)).not.toMatch(/\[\[/)
  })

  it("reindexes markers after image removal", () => {
    const before = "A [[img:0]]\nB [[img:1]]\nC [[img:2]]"
    expect(reindexDescriptionAfterImageRemoval(before, 1)).toBe("A [[img:0]]\nB C [[img:1]]")
  })

  it("inserts marker at cursor", () => {
    expect(insertImageMarkerAt("Hello world", 2, 6)).toBe("Hello [[img:2]]\nworld")
  })

  it("lists unreferenced images when markers present", () => {
    const images = ["a", "b", "c"]
    expect(unreferencedIllustrationImages("[[img:0]]\n", images)).toEqual(["b", "c"])
  })

  it("strips standalone marker lines from editor text", () => {
    const raw = `ACCROCHE
Accroche produit.

[[img:2]]
[[img:3]]
[[img:4]]

POINTS FORTS
Détail.`
    expect(stripStandaloneImageMarkerLines(raw)).toBe(`ACCROCHE
Accroche produit.

POINTS FORTS
Détail.`)
  })
})
