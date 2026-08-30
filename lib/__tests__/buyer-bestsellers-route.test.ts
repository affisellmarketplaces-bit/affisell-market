import { describe, expect, it } from "vitest"

import {
  BUYER_BESTSELLERS_LEGACY_PATH,
  BUYER_BESTSELLERS_PATH,
} from "@/lib/buyer-bestsellers-route"

describe("buyer bestsellers route", () => {
  it("uses marketplace namespace for canonical hub", () => {
    expect(BUYER_BESTSELLERS_PATH).toBe("/marketplace/bestsellers")
    expect(BUYER_BESTSELLERS_LEGACY_PATH).toBe("/bestsellers")
  })
})
