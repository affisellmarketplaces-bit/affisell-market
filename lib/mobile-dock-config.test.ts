import { describe, expect, it } from "vitest"

import { resolveMobileDockItems } from "@/lib/mobile-dock-config"
import { resolvePublicNavMode } from "@/lib/public-nav-mode"

describe("resolveMobileDockItems", () => {
  it("returns browse items on home", () => {
    const items = resolveMobileDockItems("browse")
    expect(items.map((i) => i.id)).toEqual(["home", "explore", "pulse", "stores", "cart"])
  })

  it("returns account items on account mode", () => {
    const items = resolveMobileDockItems("account")
    expect(items.map((i) => i.id)).toEqual(["home", "orders", "account", "wishlist", "cart"])
  })

  it("aligns with public nav mode resolver", () => {
    expect(resolveMobileDockItems(resolvePublicNavMode("/wishlist")).some((i) => i.id === "wishlist")).toBe(
      true
    )
    expect(resolveMobileDockItems(resolvePublicNavMode("/")).some((i) => i.id === "pulse")).toBe(true)
  })

  it("highlights orders on orders page", () => {
    const items = resolveMobileDockItems("account")
    const orders = items.find((i) => i.id === "orders")
    expect(orders?.match("/marketplace/account/orders")).toBe(true)
    expect(orders?.match("/marketplace/account/wallet")).toBe(false)
  })
})
