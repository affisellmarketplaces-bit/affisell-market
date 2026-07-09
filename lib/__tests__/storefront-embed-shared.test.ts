import { describe, expect, it } from "vitest"

import {
  buildDefaultEmbedWidget,
  buildStoreEmbedIframeSnippet,
  hasMeaningfulEmbedWidget,
  parseEmbedWidget,
  storeEmbedPublicUrl,
} from "@/lib/storefront-embed-shared"

describe("storefront-embed-shared", () => {
  it("parses embed widget with defaults", () => {
    expect(parseEmbedWidget(undefined)).toEqual({ enabled: false, productLimit: 4 })
    expect(parseEmbedWidget({ enabled: true, title: " Shop ", productLimit: 12 })).toEqual({
      enabled: true,
      title: "Shop",
      productLimit: 6,
    })
  })

  it("builds embed URL and iframe snippet", () => {
    const url = storeEmbedPublicUrl("acme")
    expect(url).toContain("/embed/shops/acme")
    const snippet = buildStoreEmbedIframeSnippet({ slug: "acme", storeName: "Acme" })
    expect(snippet).toContain("<iframe")
    expect(snippet).toContain("/embed/shops/acme")
    expect(snippet).toContain('title="Acme"')
  })

  it("detects meaningful embed config and builds a default enabled widget", () => {
    expect(hasMeaningfulEmbedWidget({ enabled: false, productLimit: 4 })).toBe(false)
    expect(
      buildDefaultEmbedWidget({
        storeName: "Acme",
      })
    ).toEqual({
      enabled: true,
      title: "Shop curated picks from Acme",
      productLimit: 4,
    })
  })
})
