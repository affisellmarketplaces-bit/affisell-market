import { describe, expect, it } from "vitest"

import {
  resolvePublicNavBackHref,
  resolvePublicNavMode,
} from "@/lib/public-nav-mode"

describe("resolvePublicNavMode", () => {
  it("returns browse on home", () => {
    expect(resolvePublicNavMode("/")).toBe("browse")
  })

  it("returns transaction on cart", () => {
    expect(resolvePublicNavMode("/cart")).toBe("transaction")
  })

  it("returns transaction on success", () => {
    expect(resolvePublicNavMode("/success")).toBe("transaction")
  })

  it("returns account on marketplace account", () => {
    expect(resolvePublicNavMode("/marketplace/account/orders")).toBe("account")
  })

  it("returns account on wishlist", () => {
    expect(resolvePublicNavMode("/wishlist")).toBe("account")
  })
})

describe("resolvePublicNavBackHref", () => {
  it("returns orders after success", () => {
    expect(resolvePublicNavBackHref("/success")).toBe("/marketplace/account/orders")
  })

  it("returns catalog from cart", () => {
    expect(resolvePublicNavBackHref("/cart")).toBe("/shops/browse")
  })
})
