import { describe, expect, it } from "vitest"

import { SUPPORTED_LOCALES } from "@/lib/i18n-locale"
import { CLIENT_MESSAGES, readLocaleFromDocumentCookie } from "@/lib/i18n-messages-client"

describe("i18n messages client", () => {
  it("loads all supported locale bundles", () => {
    for (const code of SUPPORTED_LOCALES) {
      expect(CLIENT_MESSAGES[code]).toBeTruthy()
      expect(typeof CLIENT_MESSAGES[code]).toBe("object")
    }
  })

  it("readLocaleFromDocumentCookie defaults without document", () => {
    expect(readLocaleFromDocumentCookie()).toBe("en")
  })
})
