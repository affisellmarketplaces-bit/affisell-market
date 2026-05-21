import { describe, expect, it } from "vitest"

import { hrefForLocaleSwitch } from "@/lib/client-locale-path"

describe("hrefForLocaleSwitch", () => {
  it("keeps /shops on locale change (cookie-driven UI locale)", () => {
    expect(hrefForLocaleSwitch("/shops", "", "", "fr")).toBe("/shops")
    expect(hrefForLocaleSwitch("/shops/browse", "?q=1", "", "en")).toBe("/shops/browse?q=1")
  })

  it("maps home and marketing paths to / or /fr", () => {
    expect(hrefForLocaleSwitch("/", "", "", "fr")).toBe("/fr")
    expect(hrefForLocaleSwitch("/fr", "", "", "en")).toBe("/")
    expect(hrefForLocaleSwitch("/agent", "", "", "fr")).toBe("/fr/agent")
    expect(hrefForLocaleSwitch("/fr/agent", "", "", "en")).toBe("/agent")
    expect(hrefForLocaleSwitch("/creators", "", "#cta", "fr")).toBe("/fr/creators#cta")
    expect(hrefForLocaleSwitch("/fr/partners", "", "", "en")).toBe("/partners")
  })
})
