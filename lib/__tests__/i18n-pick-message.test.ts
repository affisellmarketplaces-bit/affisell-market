import { describe, expect, it } from "vitest"

import { loadAppMessages } from "@/lib/i18n-load-messages"
import { tMessage } from "@/lib/i18n-pick-message"

describe("i18n-pick-message", () => {
  it("tMessage resolves known keys without throwing", () => {
    expect(tMessage("fr", "globalError.title")).toContain("page")
    expect(tMessage("de", "globalError.title")).toBe("Diese Seite konnte nicht geladen werden")
  })

  it("tMessage falls back to the key path when a message does not exist", () => {
    expect(tMessage("de", "does.not.exist")).toBe("does.not.exist")
    expect(tMessage("de", "does.not.exist", "fallback")).toBe("fallback")
  })

  it("loadAppMessages returns the same merged bundle reference per locale", () => {
    const a = loadAppMessages("fr")
    const b = loadAppMessages("fr")
    expect(a).toBe(b)
  })

  it("tMessage hot path does not rebuild locale bundles", () => {
    const before = loadAppMessages("de")
    for (let i = 0; i < 50; i++) {
      tMessage("de", "Product.logistics.deliveryRange")
    }
    expect(loadAppMessages("de")).toBe(before)
  })
})
