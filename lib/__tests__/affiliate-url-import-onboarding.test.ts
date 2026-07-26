import { describe, expect, it } from "vitest"

import {
  AFFILIATE_URL_IMPORT_HREF,
  affiliateUrlImportSignupHref,
} from "@/lib/affiliate-onboarding-shared"

describe("affiliateUrlImportSignupHref", () => {
  it("returns signup with next=/dropforge when no url", () => {
    expect(affiliateUrlImportSignupHref()).toBe(
      `/signup/affiliate?next=${encodeURIComponent(AFFILIATE_URL_IMPORT_HREF)}`
    )
    expect(AFFILIATE_URL_IMPORT_HREF).toBe("/dropforge")
  })

  it("preserves product url + auto preview flag", () => {
    const href = affiliateUrlImportSignupHref("https://www.temu.com/item.html")
    expect(href.startsWith("/signup/affiliate?next=")).toBe(true)
    const next = decodeURIComponent(href.split("next=")[1] ?? "")
    expect(next).toContain("/dropforge?url=")
    expect(next).toContain("auto=1")
    expect(next).toContain(encodeURIComponent("https://www.temu.com/item.html"))
  })
})
