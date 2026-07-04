import { describe, expect, it } from "vitest"

import {
  buildStoreEmbedIframeSnippet,
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
})
