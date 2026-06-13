import { describe, expect, it } from "vitest"

import {
  clearStoreResolveMemoryCacheForTests,
  readStoreResolveCookie,
  resolveAffisellSubdomainHost,
  rememberStoreResolve,
  resolveStoreHostForMiddleware,
  storeResolveCookieValue,
} from "@/lib/middleware-store-resolve"

describe("resolveAffisellSubdomainHost", () => {
  it("resolves slug without network", () => {
    const resolved = resolveAffisellSubdomainHost("ecom-store.shops.localhost")
    expect(resolved?.slug).toBe("ecom-store")
    expect(resolved?.role).toBe("AFFILIATE")
    expect(resolved?.storePrefix).toBe("/shops/ecom-store")
  })
})

describe("resolveStoreHostForMiddleware", () => {
  it("uses memory cache before remote fetch", async () => {
    clearStoreResolveMemoryCacheForTests()
    rememberStoreResolve("boutique.example.fr", {
      found: true,
      slug: "boutique",
      role: "AFFILIATE",
      storePrefix: "/shops/boutique",
    })

    let fetchCalls = 0
    const resolved = await resolveStoreHostForMiddleware(
      { cookies: { get: () => undefined } } as never,
      "boutique.example.fr",
      async () => {
        fetchCalls += 1
        return null
      }
    )

    expect(resolved?.slug).toBe("boutique")
    expect(fetchCalls).toBe(0)
  })

  it("reads sticky cookie", async () => {
    clearStoreResolveMemoryCacheForTests()
    const value = storeResolveCookieValue("shop.test", {
      found: true,
      slug: "shop",
      role: "AFFILIATE",
      storePrefix: "/shops/shop",
    })

    const resolved = await resolveStoreHostForMiddleware(
      {
        cookies: {
          get: (name: string) => (name === "affisell_store_ctx" ? { value } : undefined),
        },
      } as never,
      "shop.test",
      async () => null
    )

    expect(resolved?.slug).toBe("shop")
  })
})

describe("readStoreResolveCookie", () => {
  it("ignores cookie for another host", () => {
    const value = storeResolveCookieValue("a.test", {
      found: true,
      slug: "a",
      role: "AFFILIATE",
      storePrefix: "/shops/a",
    })
    const result = readStoreResolveCookie(
      {
        cookies: {
          get: () => ({ value }),
        },
      } as never,
      "b.test"
    )
    expect(result).toBeNull()
  })
})
