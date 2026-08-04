import { describe, expect, it } from "vitest"

import { isAliExpressImportInput, parseAliExpressProductId } from "@/lib/aliexpress-product-id"

describe("parseAliExpressProductId", () => {
  it("parses bare id", () => {
    expect(parseAliExpressProductId("1005008719608144")).toBe("1005008719608144")
  })

  it("parses item URL with trailing junk", () => {
    expect(
      parseAliExpressProductId(
        "https://www.aliexpress.com/item/1005008719608144.html e"
      )
    ).toBe("1005008719608144")
  })

  it("parses tracking / origin_prod embeds", () => {
    expect(
      parseAliExpressProductId(
        "https://s.click.aliexpress.com/e/_pSomething?_p_origin_prod:1005012670002032"
      )
    ).toBe("1005012670002032")
    expect(
      parseAliExpressProductId(
        "https://www.aliexpress.com/item/x.html?%7C_p_origin_prod%3A1005012670002032"
      )
    ).toBe("1005012670002032")
  })
})
