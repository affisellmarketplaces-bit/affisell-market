import { describe, expect, it } from "vitest"

import { CLIENT_MESSAGES, readLocaleFromDocumentCookie } from "@/lib/i18n-messages-client"

describe("i18n messages client", () => {
  it("loads en and fr message bundles", () => {
    expect(CLIENT_MESSAGES.en).toBeTruthy()
    expect(CLIENT_MESSAGES.fr).toBeTruthy()
    expect(typeof CLIENT_MESSAGES.en).toBe("object")
  })

  it("readLocaleFromDocumentCookie defaults without document", () => {
    expect(readLocaleFromDocumentCookie()).toBe("en")
  })
})
