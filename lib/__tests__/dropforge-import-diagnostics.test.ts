import { describe, expect, it } from "vitest"

import { dropForgeImportFailureHints } from "@/lib/dropforge-import-diagnostics"

describe("dropForgeImportFailureHints", () => {
  it("mentions AliExpress API and ScrapingBee for AE imports", () => {
    const hints = dropForgeImportFailureHints("AliExpress")
    expect(hints.some((h) => /ALIEXPRESS/i.test(h))).toBe(true)
    expect(hints.some((h) => /SCRAPINGBEE/i.test(h))).toBe(true)
    expect(hints.some((h) => /item\/\{id\}/i.test(h))).toBe(true)
  })
})
