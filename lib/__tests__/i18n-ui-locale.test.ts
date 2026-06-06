import { describe, expect, it } from "vitest"

import { resolveBinaryCopyLocale } from "@/lib/i18n-ui-locale"

describe("resolveBinaryCopyLocale", () => {
  it("maps fr to fr and everything else to en", () => {
    expect(resolveBinaryCopyLocale("fr")).toBe("fr")
    expect(resolveBinaryCopyLocale("en")).toBe("en")
    expect(resolveBinaryCopyLocale("de")).toBe("en")
    expect(resolveBinaryCopyLocale("es")).toBe("en")
  })
})
