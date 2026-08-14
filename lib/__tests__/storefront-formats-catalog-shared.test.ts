import { describe, expect, it } from "vitest"

import {
  buildStorefrontFormatTestLinks,
  findStorefrontFormat,
  STOREFRONT_FORMAT_CATALOG,
  STOREFRONT_FORMAT_IDS,
} from "@/lib/storefront/storefront-formats-catalog-shared"

describe("storefront-formats-catalog-shared", () => {
  it("registers all primary storefront formats", () => {
    expect(STOREFRONT_FORMAT_IDS).toHaveLength(5)
    expect(STOREFRONT_FORMAT_CATALOG.map((f) => f.id)).toEqual([...STOREFRONT_FORMAT_IDS])
  })

  it("builds affiliate shop test links from slug context", () => {
    const links = buildStorefrontFormatTestLinks("brand-studio-shops", {
      affiliateStoreSlug: "ecom-store",
      supplierStoreSlug: null,
      legionUsername: null,
    })
    expect(links.some((l) => l.href === "/shops/ecom-store")).toBe(true)
    expect(links.some((l) => l.href.includes("preview=affiliate"))).toBe(true)
  })

  it("builds boutique theme preview links", () => {
    const links = buildStorefrontFormatTestLinks("boutique-procedural", {
      affiliateStoreSlug: "ecom-store",
      supplierStoreSlug: null,
      legionUsername: null,
    })
    expect(links.some((l) => l.href.startsWith("/boutique/ecom-store?theme=t-"))).toBe(true)
  })

  it("falls back when slugs are missing", () => {
    const links = buildStorefrontFormatTestLinks("brand-studio-shops", {
      affiliateStoreSlug: null,
      supplierStoreSlug: null,
      legionUsername: null,
    })
    expect(links[0]?.href).toBe("/shops/browse")
  })

  it("finds format by id", () => {
    expect(findStorefrontFormat("legion-profile").routePattern).toBe("/u/{username}")
  })
})
