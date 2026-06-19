import { afterEach, describe, expect, it, vi } from "vitest"

import { resolveCheckoutBaseUrl } from "@/lib/checkout-base-url"

describe("resolveCheckoutBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("prefers request origin in development", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://affisell.com")
    const request = new Request("http://localhost:3001/api/checkout", { method: "POST" })
    expect(resolveCheckoutBaseUrl(request)).toBe("http://localhost:3001")
  })

  it("uses production env when no request is provided", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://affisell.com")
    expect(resolveCheckoutBaseUrl()).toBe("https://affisell.com")
  })
})
