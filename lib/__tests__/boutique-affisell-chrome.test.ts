import { describe, expect, it } from "vitest"

import {
  AFFISELL_BOUTIQUE_CHROME,
  resolveBoutiqueVisitorVisualTheme,
} from "@/lib/boutique/boutique-affisell-chrome-shared"

describe("boutique-affisell-chrome-shared", () => {
  it("keeps fixed platform chrome colors", () => {
    expect(AFFISELL_BOUTIQUE_CHROME.merchantHeaderFrom).toBe("#1a1f5c")
    expect(AFFISELL_BOUTIQUE_CHROME.merchantHeaderLogoTop).toBe("#4ee2ec")
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
