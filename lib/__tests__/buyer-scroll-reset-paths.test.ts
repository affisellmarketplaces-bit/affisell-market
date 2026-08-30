import { describe, expect, it } from "vitest"

import { shouldResetBuyerScroll } from "@/lib/buyer-scroll-reset-paths"

describe("shouldResetBuyerScroll", () => {
  it("resets browse category hops", () => {
    expect(shouldResetBuyerScroll("/browse/electronique")).toBe(true)
    expect(shouldResetBuyerScroll("/fr/browse/mode")).toBe(true)
  })

  it("resets bestsellers hub and marketplace PDP", () => {
    expect(shouldResetBuyerScroll("/marketplace/bestsellers")).toBe(true)
    expect(shouldResetBuyerScroll("/marketplace/cmpmibth80001la04ysgbjef6")).toBe(true)
  })

  it("skips marketplace account and reserved hubs", () => {
    expect(shouldResetBuyerScroll("/marketplace/account")).toBe(false)
    expect(shouldResetBuyerScroll("/marketplace/import")).toBe(false)
    expect(shouldResetBuyerScroll("/")).toBe(false)
  })
})
