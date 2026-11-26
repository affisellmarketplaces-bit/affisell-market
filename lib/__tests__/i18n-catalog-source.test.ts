import { describe, expect, it } from "vitest"

import * as browser from "@/lib/i18n-catalog-source.browser"
import * as server from "@/lib/i18n-catalog-source"
import { loadAppMessages } from "@/lib/i18n-load-messages"

describe("#i18n-catalog — the browser returns what the server rendered", () => {
  it("is empty until the page provider registers its messages", () => {
    expect(browser.catalogMessages("fr")).toBeUndefined()
  })

  it("returns the provider's messages for the page locale only", () => {
    const fr = loadAppMessages("fr")
    browser.registerBrowserCatalog("fr", fr)
    expect(browser.catalogMessages("fr")).toBe(fr)
    expect(browser.catalogMessages("de")).toBeUndefined()
  })

  it("the provider receives the same object the server reads (loadAppMessages), so hydration matches", () => {
    for (const locale of ["en", "fr", "de", "zh"] as const) {
      expect(server.catalogMessages(locale)).toEqual(loadAppMessages(locale))
    }
  })
})
