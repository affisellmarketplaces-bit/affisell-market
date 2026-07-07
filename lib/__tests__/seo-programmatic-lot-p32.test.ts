import { describe, expect, it } from "vitest"

import { categoryBrowsePath } from "@/lib/seo-category-pages-shared"
import { resolveSiteBaseUrl } from "@/lib/seo-site-url"

describe("seo-category-pages", () => {
  it("builds browse paths from slug", () => {
    expect(categoryBrowsePath("mode-vetements")).toBe("/browse/mode-vetements")
    expect(categoryBrowsePath("hauts-212")).toBe("/browse/hauts-212")
  })
})

describe("seo-site-url", () => {
  it("normalizes site base url", () => {
    const url = resolveSiteBaseUrl()
    expect(url).not.toMatch(/\/$/)
    expect(url.startsWith("http")).toBe(true)
  })
})

describe("seo-sitemap builders", () => {
  it("includes static acquisition pages", async () => {
    const { buildAffisellSitemap } = await import("@/lib/seo-sitemap")
    const entries = await buildAffisellSitemap({
      baseUrl: "https://affisell.com",
      shopLimit: 0,
      categoryLimit: 0,
      supplierLimit: 0,
      listingLimit: 0,
    })
    const urls = entries.map((entry) => entry.url)
    expect(urls).toContain("https://affisell.com/")
    expect(urls).toContain("https://affisell.com/shops")
    expect(urls).toContain("https://affisell.com/sell")
    expect(urls).toContain("https://affisell.com/how-it-works")
  })
})
