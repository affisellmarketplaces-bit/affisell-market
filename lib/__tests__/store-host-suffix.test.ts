import { afterEach, describe, expect, it, vi } from "vitest"

describe("store host suffix", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("parses slug from production-style subdomain", async () => {
    vi.stubEnv("AFFISELL_STORE_HOST_SUFFIX", "shops.affisell.com")
    const { parseStoreSlugFromStoreHost, storeSubdomainHost } = await import("@/lib/store-host-suffix")
    expect(parseStoreSlugFromStoreHost("marie-store.shops.affisell.com")).toBe("marie-store")
    expect(storeSubdomainHost("marie-store")).toBe("marie-store.shops.affisell.com")
  })

  it("rejects bare suffix host and invalid slugs", async () => {
    vi.stubEnv("AFFISELL_STORE_HOST_SUFFIX", "shops.affisell.com")
    const { parseStoreSlugFromStoreHost } = await import("@/lib/store-host-suffix")
    expect(parseStoreSlugFromStoreHost("shops.affisell.com")).toBeNull()
    expect(parseStoreSlugFromStoreHost("-bad.shops.affisell.com")).toBeNull()
    expect(parseStoreSlugFromStoreHost("affisell.com")).toBeNull()
  })
})
