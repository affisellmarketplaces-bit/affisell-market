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

  it("uses platform path on Vercel preview deployments", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AFFISELL_STORE_HOST_SUFFIX", "shops.affisell.com")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://affisell-market.vercel.app")

    const urls = resolveStorePublicUrls({
      slug: "ecom-store",
      role: "AFFILIATE",
    })
    expect(urls.platformPathUrl).toBe("https://affisell-market.vercel.app/shops/ecom-store")
    expect(urls.primaryUrl).toBe(urls.platformPathUrl)
    expect(urls.subdomainUrl).toBe("https://ecom-store.shops.affisell.com")
  })

  it("uses auto subdomain as primary on production when SSL active", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AFFISELL_STORE_HOST_SUFFIX", "shops.affisell.com")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://affisell.com")

    const urls = resolveStorePublicUrls({
      slug: "my-shop",
      role: "AFFILIATE",
      subdomainVercelStatus: "active",
    })
    expect(urls.subdomainUrl).toBe("https://my-shop.shops.affisell.com")
    expect(urls.primaryUrl).toBe(urls.subdomainUrl)
    expect(urls.subdomainSslActive).toBe(true)
    expect(urls.platformPathUrl).toContain("/shops/my-shop")
  })

  it("uses platform path when subdomain SSL is not active yet", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AFFISELL_STORE_HOST_SUFFIX", "shops.affisell.com")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://affisell.com")

    const urls = resolveStorePublicUrls({
      slug: "ecom-store",
      role: "AFFILIATE",
      subdomainVercelStatus: "pending",
    })
    expect(urls.primaryUrl).toBe("https://affisell.com/shops/ecom-store")
    expect(urls.subdomainSslActive).toBe(false)
  })

  it("an 'unreachable' subdomain is never the primary address — the store stays on its working platform URL", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AFFISELL_STORE_HOST_SUFFIX", "shops.affisell.com")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://affisell.com")

    const urls = resolveStorePublicUrls({ slug: "ecom-store", role: "AFFILIATE", subdomainVercelStatus: "unreachable" })
    expect(urls.primaryUrl).toBe("https://affisell.com/shops/ecom-store")
    expect(urls.subdomainSslActive).toBe(false)
    expect(urls.subdomainState).toBe("unreachable")
  })

  it("exposes why the subdomain is (not) primary", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AFFISELL_STORE_HOST_SUFFIX", "shops.affisell.com")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://affisell.com")

    const state = (subdomainVercelStatus: string | null) =>
      resolveStorePublicUrls({ slug: "s", role: "AFFILIATE", subdomainVercelStatus }).subdomainState
    expect(state("active")).toBe("active")
    expect(state("unreachable")).toBe("unreachable")
    expect(state("pending")).toBe("pending")
    expect(state("registered")).toBe("pending")
    expect(state(null)).toBe("pending")
  })

  it("uses platform path in local dev for clickable links", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001")

    const urls = resolveStorePublicUrls({
      slug: "my-shop",
      customDomain: "boutique.fr",
      domainVerified: false,
      role: "AFFILIATE",
    })
    expect(urls.subdomainUrl).toBe("http://my-shop.shops.localhost:3001")
    expect(urls.primaryUrl).toBe(urls.platformPathUrl)
    expect(urls.platformPathUrl).toContain("/shops/my-shop")
  })
})
