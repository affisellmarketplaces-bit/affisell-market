import { describe, expect, it } from "vitest"

import { buyerServiceTileLinkClass } from "@/lib/home-buyer-tile-link-shared"
import { BUYER_BESTSELLERS_PATH } from "@/lib/buyer-bestsellers-route"

describe("buyerServiceTileLinkClass", () => {
  it("disables pointer events on deck children so the parent anchor receives clicks", () => {
    expect(buyerServiceTileLinkClass).toContain("[&_*]:pointer-events-none")
    expect(buyerServiceTileLinkClass).toContain("after:inset-0")
  })
})

describe("BUYER_BESTSELLERS_PATH", () => {
  it("points to the marketplace hub", () => {
    expect(BUYER_BESTSELLERS_PATH).toBe("/marketplace/bestsellers")
  })
})
