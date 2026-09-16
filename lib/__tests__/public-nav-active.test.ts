import { describe, expect, it } from "vitest"

import { resolvePublicNavActive } from "@/lib/public-nav-active"

describe("resolvePublicNavActive", () => {
  it("marks only home on /", () => {
    expect(resolvePublicNavActive("/", false)).toEqual({
      onHome: true,
      onMarketplace: false,
      onShops: false,
      onDiscover: false,
      onBattles: false,
    })
  })

  it("keeps home chrome when explorer hash is set (no global header flip)", () => {
    expect(resolvePublicNavActive("/", true)).toEqual({
      onHome: true,
      onMarketplace: false,
      onShops: false,
      onDiscover: false,
      onBattles: false,
    })
  })

  it("marks marketplace on browse path", () => {
    expect(resolvePublicNavActive("/shops/browse", false)).toEqual({
      onHome: false,
      onMarketplace: true,
      onShops: false,
      onDiscover: false,
      onBattles: false,
    })
  })

  it("marks creator stores on /shops slug", () => {
    expect(resolvePublicNavActive("/shops/riky-store", false)).toEqual({
      onHome: false,
      onMarketplace: false,
      onShops: true,
      onDiscover: false,
      onBattles: false,
    })
  })

  it("marks discover on /discover", () => {
    expect(resolvePublicNavActive("/discover", false)).toEqual({
      onHome: false,
      onMarketplace: false,
      onShops: false,
      onDiscover: true,
      onBattles: false,
    })
  })

  it("marks battles hub without activating Pulse", () => {
    expect(resolvePublicNavActive("/battles", false)).toEqual({
      onHome: false,
      onMarketplace: false,
      onShops: false,
      onDiscover: false,
      onBattles: true,
    })
  })
})
