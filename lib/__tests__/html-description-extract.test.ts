import { describe, expect, it } from "vitest"

import {
  extractHtmlDescriptionContent,
  looksLikeHtmlDescription,
  normalizeProductDescriptionFields,
} from "@/lib/html-description-extract"
import {
  extractHtmlDescriptionLight,
  sanitizeListingDescriptionField,
} from "@/lib/html-description-extract-shared"

const AE_FIXTURE = `
<div class="detailmodule_html"><div class="detail-desc-decorate-richtext">
<p><span style="font-size:16px;">Caractéristique :</span></p>
<p><span>1. Batterie au lithium haute capacité 20000mah</span></p>
<p><span>2. Compatible batterie Makita</span></p>
<img src="https://ae01.alicdn.com/kf/detail-1.jpg" />
<img data-src="https://ae01.alicdn.com/kf/detail-2.jpg" />
<p><span>3. Pression élevée pour lavage voiture</span></p>
<img src="https://ae01.alicdn.com/kf/detail-3.jpg" alt="demo" />
</div></div>
`

describe("html-description-extract", () => {
  it("detects AE detail HTML", () => {
    expect(looksLikeHtmlDescription(AE_FIXTURE)).toBe(true)
    expect(looksLikeHtmlDescription("Plain text description")).toBe(false)
  })

  it("extracts all text and all illustrative images without leaving tags", async () => {
    const extracted = extractHtmlDescriptionContent(AE_FIXTURE)
    expect(extracted.hadHtml).toBe(true)
    expect(extracted.text).toContain("Caractéristique")
    expect(extracted.text).toContain("Batterie au lithium")
    expect(extracted.text).toContain("Pression élevée")
    expect(extracted.text).not.toMatch(/<\/?[a-z]/i)
    expect(extracted.imageUrls).toHaveLength(3)
    expect(extracted.imageUrls[0]).toContain("detail-1.jpg")
    expect(extracted.text).toContain("[[img:0]]")
    expect(extracted.text).toContain("[[img:2]]")
  })

  it("light client extract also recovers images + text", () => {
    const light = extractHtmlDescriptionLight(AE_FIXTURE)
    expect(light.text).toContain("Makita")
    expect(light.imageUrls.length).toBeGreaterThanOrEqual(2)
    expect(sanitizeListingDescriptionField(AE_FIXTURE)).not.toMatch(/detailmodule/)
    expect(sanitizeListingDescriptionField(AE_FIXTURE)).not.toMatch(/\[\[img:/)
  })

  it("sanitizeListingDescriptionField strips orphan markers from plain text", () => {
    const raw = "Hello\n\n[[img:0]]\n[[img:1]]\n\nWorld"
    expect(sanitizeListingDescriptionField(raw)).toBe("Hello\n\nWorld")
  })

  it("normalizeProductDescriptionFields strips orphan markers when no illustration URLs", () => {
    const once = normalizeProductDescriptionFields({
      description: "Feature\n[[img:0]]\n[[img:1]]",
      descriptionIllustrationImages: [],
    })
    expect(once.changed).toBe(true)
    expect(once.description).not.toMatch(/\[\[img:/)
    expect(once.description).toContain("Feature")
  })

  it("extracts background-image and linked photos too", () => {
    const html = `
      <div style="background-image:url(https://ae01.alicdn.com/kf/bg-photo.jpg)">Texte</div>
      <a href="https://ae01.alicdn.com/kf/linked.png">voir</a>
    `
    const extracted = extractHtmlDescriptionContent(html)
    expect(extracted.imageUrls).toEqual(
      expect.arrayContaining([
        "https://ae01.alicdn.com/kf/bg-photo.jpg",
        "https://ae01.alicdn.com/kf/linked.png",
      ])
    )
    expect(extracted.text).toContain("Texte")
  })

  it("normalizeProductDescriptionFields is idempotent on clean text", () => {
    const once = normalizeProductDescriptionFields({
      description: AE_FIXTURE,
      descriptionIllustrationImages: [],
    })
    expect(once.changed).toBe(true)
    const twice = normalizeProductDescriptionFields({
      description: once.description,
      descriptionIllustrationImages: once.descriptionIllustrationImages,
    })
    expect(twice.changed).toBe(false)
    expect(twice.descriptionIllustrationImages).toHaveLength(3)
  })
})
