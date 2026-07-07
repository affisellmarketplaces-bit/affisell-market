import { describe, expect, it } from "vitest"

import { shopListingPath } from "@/lib/affiliate-routes"
import { categoryBrowsePath, BROWSE_STATIC_PARAMS_LIMIT } from "@/lib/seo-category-pages-shared"
import { resolveSiteBaseUrl } from "@/lib/seo-site-url"
import { homeCatalogProductHref } from "@/lib/home-catalog-product-href"
import { looksLikeAffiliateListingId, listingPublicSegment } from "@/lib/listing-public-url-shared"
import {
  listingSitemapPath,
  SITEMAP_CHUNK,
  SITEMAP_URLS_PER_CHUNK,
} from "@/lib/seo-sitemap"

describe("seo-category-pages", () => {
  it("builds browse paths from slug", () => {
    expect(categoryBrowsePath("mode-vetements")).toBe("/browse/mode-vetements")
  })

  it("caps static generation at top-N categories", () => {
    expect(BROWSE_STATIC_PARAMS_LIMIT).toBeGreaterThan(0)
    expect(BROWSE_STATIC_PARAMS_LIMIT).toBeLessThanOrEqual(100)
  })
})

describe("seo-site-url", () => {
  it("normalizes site base url", () => {
    const url = resolveSiteBaseUrl()
    expect(url).not.toMatch(/\/$/)
    expect(url.startsWith("http")).toBe(true)
  })
})

describe("listing-public-url-shared", () => {
  it("detects cuid listing ids", () => {
    expect(looksLikeAffiliateListingId("clxyz1234567890abcdefghij")).toBe(true)
    expect(looksLikeAffiliateListingId("chaussures-running")).toBe(false)
  })

  it("prefers custom slug in public segment", () => {
    expect(listingPublicSegment("clxyz1234567890abcdefghij", "chaussures-running")).toBe(
      "chaussures-running"
    )
    expect(listingPublicSegment("clxyz1234567890abcdefghij", null)).toBe("clxyz1234567890abcdefghij")
  })
})

describe("shopListingPath", () => {
  it("uses custom slug when provided", () => {
    expect(shopListingPath("my-shop", "clxyz1234567890abcdefghij", "earbuds-pro")).toBe(
      "/shops/my-shop/product/earbuds-pro"
    )
  })
})

describe("home-catalog-product-href", () => {
  it("uses custom slug in shop product url", () => {
    expect(
      homeCatalogProductHref({
        listingId: "clxyz1234567890abcdefghij",
        storeSlug: "my-shop",
        customSlug: "earbuds-pro",
      })
    ).toBe("/shops/my-shop/product/earbuds-pro")
  })
})

describe("seo-sitemap phase 2", () => {
  it("builds pretty listing paths for sitemap", () => {
    expect(
      listingSitemapPath({
        id: "clxyz1234567890abcdefghij",
        customSlug: "robe-ete",
        storeSlug: "boutique-mode",
      })
    ).toBe("/shops/boutique-mode/product/robe-ete")
  })

  it("includes shop trust pages in shops chunk", async () => {
    const { buildAffisellSitemapChunk } = await import("@/lib/seo-sitemap")
    const entries = await buildAffisellSitemapChunk(SITEMAP_CHUNK.shops, {
      baseUrl: "https://affisell.com",
      shopLimit: 1,
    })
    const urls = entries.map((entry) => entry.url)
    expect(urls.some((url) => url.endsWith("/about"))).toBe(true)
    expect(urls.some((url) => url.endsWith("/faq"))).toBe(true)
    expect(urls.some((url) => url.endsWith("/returns"))).toBe(true)
  })

  it("plans listing chunks with bounded size", async () => {
    const { planAffisellSitemapChunks } = await import("@/lib/seo-sitemap")
    const chunks = await planAffisellSitemapChunks(SITEMAP_URLS_PER_CHUNK)
    expect(chunks[0]).toBe(SITEMAP_CHUNK.core)
    expect(chunks[1]).toBe(SITEMAP_CHUNK.shops)
    expect(chunks.length).toBeGreaterThanOrEqual(3)
  })

  it("includes static acquisition pages in core chunk", async () => {
    const { buildAffisellSitemapChunk } = await import("@/lib/seo-sitemap")
    const entries = await buildAffisellSitemapChunk(SITEMAP_CHUNK.core, {
      baseUrl: "https://affisell.com",
      categoryLimit: 0,
      supplierLimit: 0,
    })
    const urls = entries.map((entry) => entry.url)
    expect(urls).toContain("https://affisell.com/")
    expect(urls).toContain("https://affisell.com/sell")
  })
})
