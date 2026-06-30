import { afterEach, describe, expect, it, vi } from "vitest"

import {
  canonicalPlatformOrigin,
  canonicalPlatformRedirectUrl,
  isVercelAppHost,
  shouldRedirectToCanonicalPlatform,
} from "@/lib/platform-canonical-url"

describe("isVercelAppHost", () => {
  it("detects vercel deployment hosts", () => {
    expect(isVercelAppHost("affisell-market.vercel.app")).toBe(true)
    expect(isVercelAppHost("affisell-market-git-main-affisell.vercel.app")).toBe(true)
  })

  it("ignores merchant and platform custom domains", () => {
    expect(isVercelAppHost("affisell.com")).toBe(false)
    expect(isVercelAppHost("marie.shops.affisell.com")).toBe(false)
    expect(isVercelAppHost("boutique.fr")).toBe(false)
  })
})

describe("canonicalPlatformOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("prefers AFFISELL_PLATFORM_ORIGIN", () => {
    vi.stubEnv("AFFISELL_PLATFORM_ORIGIN", "https://affisell.com")
    vi.stubEnv("VERCEL_URL", "affisell-market.vercel.app")
    expect(canonicalPlatformOrigin()).toBe("https://affisell.com")
  })

  it("defaults to affisell.com in production when unset", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    expect(canonicalPlatformOrigin()).toBe("https://affisell.com")
  })
})

describe("shouldRedirectToCanonicalPlatform", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("redirects vercel.app hosts in production", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://affisell.com")
    expect(shouldRedirectToCanonicalPlatform("affisell-market.vercel.app")).toBe(true)
  })

  it("redirects www to apex in production", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://affisell.com")
    expect(shouldRedirectToCanonicalPlatform("www.affisell.com")).toBe(true)
  })

  it("does not redirect on preview deployments", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    expect(shouldRedirectToCanonicalPlatform("affisell-market.vercel.app")).toBe(false)
  })

  it("does not redirect canonical host", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://affisell.com")
    expect(shouldRedirectToCanonicalPlatform("affisell.com")).toBe(false)
  })
})

describe("canonicalPlatformRedirectUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("builds redirect preserving path and query", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://affisell.com")
    expect(
      canonicalPlatformRedirectUrl(
        "affisell-market-c5qexaezn.vercel.app",
        "/marketplace/abc",
        "?writeReview=true"
      )
    ).toBe("https://affisell.com/marketplace/abc?writeReview=true")
  })
})
