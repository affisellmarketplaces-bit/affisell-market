import { afterEach, describe, expect, it, vi } from "vitest"

import { resolveStorePublicUrls, storePublicUrl } from "@/lib/store-public-url"

describe("storePublicUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses verified custom domain", () => {
    expect(
      storePublicUrl({
        slug: "shop",
        customDomain: "boutique.fr",
        domainVerified: true,
        role: "AFFILIATE",
      })
    ).toBe("https://boutique.fr")
  })

  it("uses auto subdomain as primary in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AFFISELL_STORE_HOST_SUFFIX", "shops.affisell.com")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://affisell.com")

    const urls = resolveStorePublicUrls({
      slug: "my-shop",
      role: "AFFILIATE",
    })
    expect(urls.subdomainUrl).toBe("https://my-shop.shops.affisell.com")
    expect(urls.primaryUrl).toBe(urls.subdomainUrl)
    expect(urls.platformPathUrl).toContain("/shops/my-shop")
  })

  it("uses dev subdomain URL with app port for clickable links", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001")

    const urls = resolveStorePublicUrls({
      slug: "my-shop",
      customDomain: "boutique.fr",
      domainVerified: false,
      role: "AFFILIATE",
    })
    expect(urls.subdomainUrl).toBe("http://my-shop.shops.localhost:3001")
    expect(urls.primaryUrl).toBe(urls.subdomainUrl)
    expect(urls.platformPathUrl).toContain("/shops/my-shop")
  })
})
