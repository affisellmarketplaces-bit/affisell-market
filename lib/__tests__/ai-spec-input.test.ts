import { describe, expect, it } from "vitest"

import {
  parseSpecsAiInput,
  SPECS_AI_MAX_DATA_URL_CHARS,
  SPECS_AI_MAX_TITLE_CHARS,
  SPECS_AI_MAX_URL_CHARS,
} from "@/lib/ai-spec-input"

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

describe("parseSpecsAiInput", () => {
  it("accepts a title alone, trimmed", () => {
    expect(parseSpecsAiInput({ productTitle: "  Red cotton shirt  " })).toEqual({
      ok: true,
      input: { productTitle: "Red cotton shirt" },
    })
  })

  it("accepts an https image URL alone", () => {
    expect(parseSpecsAiInput({ imageUrl: "https://cdn.example.test/a.jpg" })).toEqual({
      ok: true,
      input: { imageUrl: "https://cdn.example.test/a.jpg" },
    })
  })

  it("accepts a JPEG/PNG/WebP data URL", () => {
    expect(parseSpecsAiInput({ imageUrl: PNG_DATA_URL })).toMatchObject({ ok: true })
    expect(parseSpecsAiInput({ imageUrl: "data:image/webp;base64,UklGRg==" })).toMatchObject({ ok: true })
    expect(parseSpecsAiInput({ imageUrl: "data:image/jpeg;base64,/9j/4AAQ" })).toMatchObject({ ok: true })
  })

  it("accepts both fields", () => {
    expect(parseSpecsAiInput({ productTitle: "Shirt", imageUrl: "https://cdn.example.test/a.jpg" })).toEqual({
      ok: true,
      input: { productTitle: "Shirt", imageUrl: "https://cdn.example.test/a.jpg" },
    })
  })

  for (const body of [null, undefined, "text", 42, [], {}, { productTitle: "   " }, { productTitle: 5, imageUrl: null }]) {
    it(`needs a title or an image: ${JSON.stringify(body)}`, () => {
      expect(parseSpecsAiInput(body)).toEqual({ ok: false, error: "Either productTitle or imageUrl is required" })
    })
  }

  it("refuses a title over the cap, accepts one exactly at it", () => {
    expect(parseSpecsAiInput({ productTitle: "a".repeat(SPECS_AI_MAX_TITLE_CHARS + 1) })).toMatchObject({ ok: false })
    expect(parseSpecsAiInput({ productTitle: "a".repeat(SPECS_AI_MAX_TITLE_CHARS) })).toMatchObject({ ok: true })
  })

  const badImages = [
    "http://cdn.example.test/a.jpg",
    "ftp://cdn.example.test/a.jpg",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://user:pass@cdn.example.test/a.jpg",
    "//cdn.example.test/a.jpg",
    "/relative/a.jpg",
    "not a url",
    "data:text/html;base64,PGh0bWw+",
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "data:image/gif;base64,R0lGODlh",
    "data:image/png;base64,not base64 !!",
    "data:image/png,rawtext",
  ]
  for (const imageUrl of badImages) {
    it(`refuses image ${JSON.stringify(imageUrl).slice(0, 60)}`, () => {
      expect(parseSpecsAiInput({ productTitle: "Shirt", imageUrl })).toEqual({
        ok: false,
        error: "imageUrl must be an https URL or a JPEG/PNG/WebP data URL",
      })
    })
  }

  it("refuses an https URL over the length cap", () => {
    const long = `https://cdn.example.test/${"a".repeat(SPECS_AI_MAX_URL_CHARS)}.jpg`
    expect(parseSpecsAiInput({ imageUrl: long })).toMatchObject({ ok: false })
  })

  it("refuses a data URL over the size cap", () => {
    const huge = `data:image/png;base64,${"A".repeat(SPECS_AI_MAX_DATA_URL_CHARS)}`
    expect(parseSpecsAiInput({ imageUrl: huge })).toMatchObject({ ok: false })
  })
})
