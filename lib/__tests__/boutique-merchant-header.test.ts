import { describe, expect, it } from "vitest"

import {
  merchantAvatarInitial,
  resolveBoutiqueMerchantNav,
  resolveMerchantAvatarUrl,
} from "@/lib/boutique/boutique-merchant-header-shared"

describe("boutique-merchant-header-shared", () => {
  it("resolves affiliate nav with encoded slug", () => {
    const nav = resolveBoutiqueMerchantNav("AFFILIATE", "ecom store")
    expect(nav.boutique).toBe("/boutique/ecom%20store")
    expect(nav.brandStudio).toBe("/dashboard/affiliate/brand-studio")
  })

  it("prefers logo over ai avatar over user image", () => {
    expect(
      resolveMerchantAvatarUrl({
        logoUrl: "https://cdn/logo.png",
        aiAvatarUrl: "https://cdn/ai.png",
        userImage: "https://cdn/user.png",
      })
    ).toBe("https://cdn/logo.png")

    expect(
      resolveMerchantAvatarUrl({
        logoUrl: null,
        aiAvatarUrl: "https://cdn/ai.png",
        userImage: "https://cdn/user.png",
      })
    ).toBe("https://cdn/ai.png")
  })

  it("derives avatar initial from store name", () => {
    expect(merchantAvatarInitial("Ma Boutique")).toBe("M")
    expect(merchantAvatarInitial("")).toBe("A")
  })
})
