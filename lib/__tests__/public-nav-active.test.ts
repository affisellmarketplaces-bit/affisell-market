import { describe, expect, it } from "vitest"

import { resolvePublicNavActive } from "@/lib/public-nav-active"

describe("resolvePublicNavActive", () => {
  it("marks only home on /", () => {
    expect(resolvePublicNavActive("/", false)).toEqual({
      onHome: true,
      onMarketplace: false,
      onShops: false,
      onDiscover: false,
    })
  })

  it("marks marketplace when home explorer hash is set", () => {
    expect(resolvePublicNavActive("/", true)).toEqual({
      onHome: false,
      onMarketplace: true,
      onShops: false,
      onDiscover: false,
    })
  })

  it("marks marketplace on browse path", () => {
    expect(resolvePublicNavActive("/shops/browse", false)).toEqual({
      onHome: false,
      onMarketplace: true,
      onShops: false,
      onDiscover: false,
    })
  })

  it("marks creator stores on /shops slug", () => {
    expect(resolvePublicNavActive("/shops/riky-store", false)).toEqual({
      onHome: false,
      onMarketplace: false,
      onShops: true,
      onDiscover: false,
    })
  })

  it("marks discover on /discover", () => {
    expect(resolvePublicNavActive("/discover", false)).toEqual({
      onHome: false,
      onMarketplace: false,
      onShops: false,
      onDiscover: true,
    })
  })
})
