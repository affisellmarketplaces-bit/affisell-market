import { afterEach, describe, expect, it, vi } from "vitest"

import {
  isLocalhostUrl,
  publicAbsoluteUrl,
  resolvePublicAppUrl,
  rewriteLocalhostToPublic,
  sanitizePublicLink,
} from "@/lib/public-app-url"

describe("resolvePublicAppUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejects localhost env on production deploy", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001")
    vi.stubEnv("AFFISELL_PLATFORM_ORIGIN", "https://affisell.com")
    expect(resolvePublicAppUrl()).toBe("https://affisell.com")
  })

  it("allows localhost in development", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001")
    expect(resolvePublicAppUrl()).toBe("http://localhost:3001")
  })

  it("falls back to affisell.com in production when env missing", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_ENV", "production")
    expect(resolvePublicAppUrl()).toBe("https://affisell.com")
  })
})

describe("publicAbsoluteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("builds track-order link on public domain in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001")
    expect(publicAbsoluteUrl("/track-order")).toBe("https://affisell.com/track-order")
  })
})

describe("rewriteLocalhostToPublic", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rewrites localhost track-order to affisell.com", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_ENV", "production")
    expect(rewriteLocalhostToPublic("http://localhost:3001/track-order")).toBe(
      "https://affisell.com/track-order"
    )
  })
})

describe("sanitizePublicLink", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rewrites localhost and relative paths to public HTTPS URLs", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("AFFISELL_PLATFORM_ORIGIN", "https://affisell.com")
    expect(sanitizePublicLink("http://localhost:3001/track-order")).toBe(
      "https://affisell.com/track-order"
    )
    expect(sanitizePublicLink("/marketplace/account/orders")).toBe(
      "https://affisell.com/marketplace/account/orders"
    )
  })
})

describe("isLocalhostUrl", () => {
  it("detects localhost origins", () => {
    expect(isLocalhostUrl("http://localhost:3001/track-order")).toBe(true)
    expect(isLocalhostUrl("https://affisell.com/track-order")).toBe(false)
  })
})
