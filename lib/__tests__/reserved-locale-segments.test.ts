import { describe, expect, it } from "vitest"

import { isStaticAppPathname, RESERVED_LOCALE_SEGMENTS } from "@/lib/reserved-locale-segments"

describe("isStaticAppPathname", () => {
  it("treats app routes as static, not locales", () => {
    expect(isStaticAppPathname("/agent")).toBe(true)
    expect(isStaticAppPathname("/contact")).toBe(true)
    expect(isStaticAppPathname("/dashboard/supplier")).toBe(true)
  })

  it("does not treat locale codes as static app paths", () => {
    expect(isStaticAppPathname("/fr")).toBe(false)
    expect(isStaticAppPathname("/en")).toBe(false)
    expect(RESERVED_LOCALE_SEGMENTS.has("fr")).toBe(false)
  })
})
