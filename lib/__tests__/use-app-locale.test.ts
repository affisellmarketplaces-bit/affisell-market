import { describe, expect, it } from "vitest"

import { APP_LOCALE_CHANGED_EVENT, notifyAppLocaleChanged } from "@/hooks/use-app-locale"
import { readLocaleFromDocumentCookie } from "@/lib/i18n-read-locale-cookie"

describe("i18n-read-locale-cookie", () => {
  it("defaults to en without document", () => {
    expect(readLocaleFromDocumentCookie()).toBe("en")
  })
})

describe("use-app-locale events", () => {
  it("exports a stable locale-changed event name", () => {
    expect(APP_LOCALE_CHANGED_EVENT).toBe("affisell:locale-changed")
    expect(typeof notifyAppLocaleChanged).toBe("function")
  })
})
