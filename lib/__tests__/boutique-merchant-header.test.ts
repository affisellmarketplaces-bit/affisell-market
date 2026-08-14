import { describe, expect, it } from "vitest"

import {
  merchantAvatarInitial,
  resolveBoutiqueMerchantNav,
  resolveMerchantAvatarUrl,
  resolveStoreAvatarUrl,
} from "@/lib/boutique/boutique-merchant-header-shared"

describe("boutique-merchant-header-shared", () => {
  it("resolves affiliate nav with encoded slug", () => {
    const nav = resolveBoutiqueMerchantNav("AFFILIATE", "ecom store")
    expect(nav.boutique).toBe("/boutique/ecom%20store")
    expect(nav.brandStudio).toBe("/dashboard/affiliate/brand-studio")
  })

  it("store avatar prefers logo over ai avatar only", () => {
    expect(
      resolveStoreAvatarUrl({
        logoUrl: "https://cdn/logo.png",
        aiAvatarUrl: "https://cdn/ai.png",
      })
    ).toBe("https://cdn/logo.png")

    expect(
      resolveStoreAvatarUrl({
        logoUrl: null,
        aiAvatarUrl: "https://cdn/ai.png",
      })
    ).toBe("https://cdn/ai.png")

    expect(resolveStoreAvatarUrl({ logoUrl: null, aiAvatarUrl: null })).toBeNull()
  })

  it("legacy helper can still fall back to user image", () => {
    expect(
      resolveMerchantAvatarUrl({
        logoUrl: null,
        aiAvatarUrl: null,
        userImage: "https://cdn/user.png",
      })
    ).toBe("https://cdn/user.png")
  })

  it("derives avatar initial from store name", () => {
    expect(merchantAvatarInitial("Ma Boutique")).toBe("M")
    expect(merchantAvatarInitial("")).toBe("A")
  })
})
