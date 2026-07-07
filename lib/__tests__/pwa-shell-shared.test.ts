import { describe, expect, it } from "vitest"

import {
  PWA_CATALOG_API_PATH,
  PWA_OFFLINE_NAV_PREFIXES,
  PWA_PRECACHE_URLS,
  PWA_SHELL_CACHE,
  PWA_SHELL_CACHE_VERSION,
  PWA_SW_PATH,
} from "@/lib/pwa-shell-shared"

describe("pwa-shell-shared", () => {
  it("exposes stable cache keys for the service worker", () => {
    expect(PWA_SHELL_CACHE).toBe(`${PWA_SHELL_CACHE_VERSION}-shell`)
    expect(PWA_SW_PATH).toBe("/sw.js")
    expect(PWA_PRECACHE_URLS).toContain("/offline")
    expect(PWA_CATALOG_API_PATH).toBe("/api/marketplace/products")
    expect(PWA_OFFLINE_NAV_PREFIXES).toContain("/")
  })
})
