import { describe, expect, it } from "vitest"

import {
  wholesaleChangePushCopy,
  wholesaleChangePushUrl,
} from "@/lib/web-push-send"

describe("wholesale-change push", () => {
  it("builds dashboard deep link", () => {
    expect(wholesaleChangePushUrl("listing-abc")).toBe(
      "/dashboard/affiliate?editListing=listing-abc"
    )
  })

  it("includes loss hint when at loss", () => {
    const copy = wholesaleChangePushCopy({
      productName: "MacBook Pro",
      atLoss: true,
      variantCount: 2,
    })
    expect(copy.title).toContain("hausse")
    expect(copy.body).toContain("MacBook Pro")
    expect(copy.body).toContain("2 variante")
    expect(copy.body).toContain("perte")
  })

  it("handles base price increase without variants", () => {
    const copy = wholesaleChangePushCopy({
      productName: "Casque",
      atLoss: false,
      variantCount: 0,
    })
    expect(copy.body).toContain("revoyez votre marge")
  })
})
