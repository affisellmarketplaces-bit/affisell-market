import { describe, expect, it } from "vitest"

import {
  buildSmartScanPatch,
  buildSmartScanRequestBody,
  parseSmartScanResponse,
  parseSuggestedPriceEur,
  shouldTriggerSmartScan,
  smartScanFingerprint,
} from "@/lib/supplier-smart-scan"

describe("parseSuggestedPriceEur", () => {
  it("accepts a plausible number or numeric string, comma or dot", () => {
    expect(parseSuggestedPriceEur(49.9)).toBe(49.9)
    expect(parseSuggestedPriceEur("49,90")).toBe(49.9)
    expect(parseSuggestedPriceEur("49.90")).toBe(49.9)
  })

  it("rejects zero, negative, absurdly large, or non-numeric values", () => {
    expect(parseSuggestedPriceEur(0)).toBeNull()
    expect(parseSuggestedPriceEur(-5)).toBeNull()
    expect(parseSuggestedPriceEur(999_999)).toBeNull()
    expect(parseSuggestedPriceEur(null)).toBeNull()
    expect(parseSuggestedPriceEur(undefined)).toBeNull()
    expect(parseSuggestedPriceEur("not a price")).toBeNull()
    expect(parseSuggestedPriceEur({})).toBeNull()
  })

  it("rounds to cents", () => {
    expect(parseSuggestedPriceEur(19.999)).toBe(20)
    expect(parseSuggestedPriceEur(19.994)).toBe(19.99)
  })
})

describe("shouldTriggerSmartScan", () => {
  const base = {
    categoryId: "cat-1",
    description: "",
    images: ["https://cdn.affisell.com/x.jpg"],
    lastRunFingerprint: null,
  }

  it("fires once a category is set and a photo is present", () => {
    expect(shouldTriggerSmartScan(base)).toBe(true)
  })

  it("never fires without a category", () => {
    expect(shouldTriggerSmartScan({ ...base, categoryId: "" })).toBe(false)
    expect(shouldTriggerSmartScan({ ...base, categoryId: "   " })).toBe(false)
  })

  it("never fires without a usable photo (blob preview only)", () => {
    expect(shouldTriggerSmartScan({ ...base, images: ["blob:http://localhost/abc"] })).toBe(false)
    expect(shouldTriggerSmartScan({ ...base, images: [] })).toBe(false)
  })

  it("accepts either an https URL or a data: image", () => {
    expect(
      shouldTriggerSmartScan({ ...base, images: ["data:image/png;base64,AAAA"] })
    ).toBe(true)
  })

  it("does not fire once the supplier has started writing their own description", () => {
    expect(shouldTriggerSmartScan({ ...base, description: "Un très joli produit" })).toBe(false)
  })

  it("still fires on a near-empty/whitespace description", () => {
    expect(shouldTriggerSmartScan({ ...base, description: "   " })).toBe(true)
  })

  it("never re-fires for the same category+photo combination", () => {
    const fp = smartScanFingerprint(base.categoryId, base.images)
    expect(shouldTriggerSmartScan({ ...base, lastRunFingerprint: fp })).toBe(false)
  })

  it("fires again after the category or the photo changes", () => {
    const fp = smartScanFingerprint(base.categoryId, base.images)
    expect(shouldTriggerSmartScan({ ...base, categoryId: "cat-2", lastRunFingerprint: fp })).toBe(true)
    expect(
      shouldTriggerSmartScan({
        ...base,
        images: ["https://cdn.affisell.com/other.jpg"],
        lastRunFingerprint: fp,
      })
    ).toBe(true)
  })
})

describe("buildSmartScanRequestBody", () => {
  it("splits https URLs and data URLs, ignoring blob previews", () => {
    const body = buildSmartScanRequestBody({
      name: "  Montre  ",
      description: "",
      images: [
        "blob:http://localhost/preview",
        "https://cdn.affisell.com/a.jpg",
        "data:image/webp;base64,BBBB",
      ],
      categoryPathLabel: "Mode > Montres",
      characteristics: [{ key: "brand", label: "Marque", type: "TEXT", options: [], required: true }],
    })
    expect(body).toEqual({
      name: "Montre",
      description: "",
      imageUrls: ["https://cdn.affisell.com/a.jpg"],
      imageDataUrls: ["data:image/webp;base64,BBBB"],
      categoryPath: "Mode > Montres",
      characteristics: [{ key: "brand", label: "Marque", type: "TEXT", options: [], required: true }],
    })
  })
})

describe("parseSmartScanResponse", () => {
  it("parses a full, well-formed response", () => {
    expect(
      parseSmartScanResponse({
        description: "Belle montre connectée",
        specs: { brand: "Affisell", color: "Noir" },
        suggestedPriceEur: 49.9,
        duplicate: true,
      })
    ).toEqual({
      description: "Belle montre connectée",
      specs: { brand: "Affisell", color: "Noir" },
      suggestedPriceEur: 49.9,
      duplicate: true,
    })
  })

  it("degrades to null on garbage input instead of throwing", () => {
    expect(parseSmartScanResponse(null)).toBeNull()
    expect(parseSmartScanResponse(undefined)).toBeNull()
    expect(parseSmartScanResponse("not an object")).toBeNull()
    expect(parseSmartScanResponse(42)).toBeNull()
  })

  it("degrades to null when the response is empty/unusable", () => {
    expect(parseSmartScanResponse({ description: "", specs: {}, suggestedPriceEur: null })).toBeNull()
    expect(parseSmartScanResponse({ description: "", specs: {}, suggestedPriceEur: -5 })).toBeNull()
  })

  it("ignores non-string spec values and non-positive prices", () => {
    const parsed = parseSmartScanResponse({
      description: "x",
      specs: { a: "ok", b: 123, c: null },
      suggestedPriceEur: -10,
    })
    expect(parsed).toEqual({ description: "x", specs: { a: "ok" }, suggestedPriceEur: null, duplicate: false })
  })

  it("defaults duplicate to false when absent", () => {
    const parsed = parseSmartScanResponse({ description: "x", specs: {} })
    expect(parsed?.duplicate).toBe(false)
  })
})

describe("buildSmartScanPatch", () => {
  const result = {
    description: "AI-written description",
    specs: { brand: "Affisell" },
    suggestedPriceEur: 29.9,
    duplicate: false,
  }

  it("applies description and price when the supplier hasn't touched either", () => {
    const patch = buildSmartScanPatch(result, { description: "", price: "" })
    expect(patch).toEqual({
      description: "AI-written description",
      specValuesPatch: { brand: "Affisell" },
      price: "29.9",
      duplicate: false,
    })
  })

  it("never overwrites a description the supplier is already writing", () => {
    const patch = buildSmartScanPatch(result, { description: "Ma propre description", price: "" })
    expect(patch.description).toBeUndefined()
  })

  it("never overwrites a price the supplier already set", () => {
    const patch = buildSmartScanPatch(result, { description: "", price: "15" })
    expect(patch.price).toBeUndefined()
  })

  it("always merges specs regardless of description/price state — specs only fill empty gaps downstream", () => {
    const patch = buildSmartScanPatch(result, { description: "own text", price: "15" })
    expect(patch.specValuesPatch).toEqual({ brand: "Affisell" })
  })

  it("carries the duplicate flag through untouched", () => {
    const patch = buildSmartScanPatch({ ...result, duplicate: true }, { description: "", price: "" })
    expect(patch.duplicate).toBe(true)
  })
})
