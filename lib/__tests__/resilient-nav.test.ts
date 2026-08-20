import { describe, expect, it } from "vitest"

import {
  hrefPathFromString,
  isInPageHashLink,
  shouldHardFallbackNav,
} from "@/lib/resilient-nav"

describe("resilient-nav", () => {
  it("detects in-page hash links", () => {
    expect(isInPageHashLink("/#explorer")).toBe(true)
    expect(isInPageHashLink("/shops/browse")).toBe(false)
  })

  it("strips hash for path compare", () => {
    expect(hrefPathFromString("/shops/foo#bar")).toBe("/shops/foo")
  })

  it("hard fallback when route unchanged", () => {
    expect(shouldHardFallbackNav("/shops/ecom-store/product/abc", "/")).toBe(true)
  })
})
