import { afterEach, describe, expect, it, vi } from "vitest"

import { getAbsoluteUrl, getSiteUrl } from "@/lib/site-url"

describe("getSiteUrl / getAbsoluteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("never returns localhost when VERCEL_ENV=production even if env is mis-set", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001")
    expect(getSiteUrl()).toBe("https://affisell.com")
    expect(getAbsoluteUrl("/dashboard")).toBe("https://affisell.com/dashboard")
  })

  it("uses NEXT_PUBLIC_APP_URL in development", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001")
    expect(getSiteUrl()).toBe("http://localhost:3001")
    expect(getAbsoluteUrl("api/health")).toBe("http://localhost:3001/api/health")
  })
})
