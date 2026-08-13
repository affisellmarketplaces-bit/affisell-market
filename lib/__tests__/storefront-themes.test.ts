import { describe, expect, it } from "vitest"

import {
  DEFAULT_STOREFRONT_THEME_ID,
  nextStorefrontThemeId,
  parseStorefrontThemeId,
  storefrontThemeStorageKey,
} from "@/lib/boutique/storefront-themes"

describe("storefront-themes", () => {
  it("parses valid theme ids", () => {
    expect(parseStorefrontThemeId("dark-futuristic")).toBe("dark-futuristic")
    expect(parseStorefrontThemeId("neon-cyber")).toBe("neon-cyber")
    expect(parseStorefrontThemeId("invalid")).toBeNull()
  })

  it("cycles themes", () => {
    expect(nextStorefrontThemeId("dark-futuristic")).toBe("light-minimal")
    expect(nextStorefrontThemeId("neon-cyber")).toBe(DEFAULT_STOREFRONT_THEME_ID)
  })

  it("builds storage keys per slug", () => {
    expect(storefrontThemeStorageKey("ecom-store")).toBe("affisell:store-theme:ecom-store")
  })
})
