import { describe, expect, it } from "vitest"

import { normalizeWooShopDomain, isAllowedWooShopProtocol } from "@/lib/integrations/woo-domain"

describe("woo domain normalization", () => {
  it("normalizes tastewp URL to origin", () => {
    expect(normalizeWooShopDomain("https://demo.tastewp.com/shop")).toBe("https://demo.tastewp.com")
  })

  it("adds https when missing", () => {
    expect(normalizeWooShopDomain("my-store.com")).toBe("https://my-store.com")
  })

  it("allows http for tastewp", () => {
    const url = new URL("http://foo.tastewp.com")
    expect(isAllowedWooShopProtocol(url)).toBe(true)
  })

  it("rejects invalid URL", () => {
    expect(normalizeWooShopDomain("")).toBeNull()
  })
})
