import { describe, expect, it } from "vitest"

import { resolveBoutiqueVisitorVisualTheme } from "@/lib/boutique/boutique-affisell-chrome-shared"
import { getStorefrontThemeById } from "@/lib/boutique/storefront-theme-engine"

describe("boutique-affisell-chrome-shared", () => {
  it("merchant header tints align with shell gradient for seamless chrome", () => {
    const theme = getStorefrontThemeById("t-0185")
    expect(theme.cssVars.merchantHeaderFrom).toBe(theme.cssVars.shellGradientFrom)
    expect(theme.cssVars.merchantHeaderVia).toBe(theme.cssVars.shellGradientVia)
    expect(theme.cssVars.merchantHeaderTo).toBe(theme.cssVars.shellGradientTo)
  })

  it("buyers always receive persisted theme", () => {
    expect(
      resolveBoutiqueVisitorVisualTheme({
        persistedThemeId: "t-0184",
        requestedThemeId: "t-0999",
        viewerIsOwner: false,
      })
    ).toBe("t-0184")
  })

  it("owners may preview via ?theme=", () => {
    expect(
      resolveBoutiqueVisitorVisualTheme({
        persistedThemeId: "t-0184",
        requestedThemeId: "t-0999",
        viewerIsOwner: true,
      })
    ).toBe("t-0999")
  })

  it("owners fall back to persisted when preview invalid", () => {
    expect(
      resolveBoutiqueVisitorVisualTheme({
        persistedThemeId: "t-0184",
        requestedThemeId: "invalid",
        viewerIsOwner: true,
      })
    ).toBe("t-0184")
  })
})
